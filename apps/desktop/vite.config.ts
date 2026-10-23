import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "child_process";
import path from "path";
import http from "http";
import fs from "fs";
import os from "os";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "screencapture-bridge-api",
      configureServer(server) {
        // Spawn Python Whisper ASR worker for pure digital screen audio
        const asrScript = path.resolve(__dirname, "scripts/asr_service.py");
        const asrChild = spawn("python3", [asrScript, "5174"], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        asrChild.stdout?.on("data", (d) => process.stdout.write(`[ASR] ${d}`));
        asrChild.stderr?.on("data", (d) => process.stderr.write(`[ASR] ${d}`));

        server.httpServer?.on("close", () => {
          asrChild.kill();
        });
        process.on("exit", () => {
          asrChild.kill();
        });

        // Endpoint 1: List active macOS windows via Apple ScreenCaptureKit
        server.middlewares.use("/api/screencapture/windows", (req, res) => {
          const bridgePath = path.resolve(__dirname, "src-tauri/bin/screencapture-bridge");
          const child = spawn(bridgePath, ["list-windows"]);
          let output = "";
          child.stdout.on("data", (data) => {
            output += data.toString();
          });
          child.on("close", () => {
            res.setHeader("Content-Type", "application/json");
            res.end(output || "[]");
          });
        });

        // Endpoint 2: Native ScreenCaptureKit + Apple Speech live transcription stream
        server.middlewares.use("/api/screencapture/transcribe", (req, res) => {
          const url = new URL(req.url || "", `http://${req.headers.host}`);
          const pid = url.searchParams.get("pid");
          const bridgePath = path.resolve(__dirname, "src-tauri/bin/screencapture-bridge");
          const args = ["transcribe"];
          if (pid) args.push(pid);

          const child = spawn(bridgePath, args);

          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          });

          res.write("data: connected\n\n");

          child.stdout.on("data", (data) => {
            const lines = data.toString().split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                res.write(`data: ${trimmed}\n\n`);
              }
            }
          });

          req.on("close", () => {
            child.kill();
          });
        });

        // Endpoint 3: Direct digital screen audio chunk transcription via native whisper.cpp
        server.middlewares.use("/api/screencapture/transcribe-chunk", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }

          const incomingUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
          const lang = incomingUrl.searchParams.get("lang") || "auto";
          const task = incomingUrl.searchParams.get("task") || "transcribe";

          const whisperBin = path.resolve(__dirname, "src-tauri/bin/whisper-sidecar-aarch64-apple-darwin");
          const modelPath = path.resolve(__dirname, "src-tauri/models/ggml-tiny.bin");

          const chunks: Buffer[] = [];
          req.on("data", (c) => chunks.push(c));
          req.on("end", () => {
            const raw = Buffer.concat(chunks);
            if (raw.length < 9600) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ text: "" }));
              return;
            }

            if (fs.existsSync(whisperBin) && fs.existsSync(modelPath)) {
              // Native whisper.cpp Metal GPU execution
              const tempWav = path.join(os.tmpdir(), `livespeak_chunk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.wav`);
              const header = Buffer.alloc(44);
              header.write("RIFF", 0);
              header.writeUInt32LE(36 + raw.length, 4);
              header.write("WAVE", 8);
              header.write("fmt ", 12);
              header.writeUInt32LE(16, 16);
              header.writeUInt16LE(3, 20); // IEEE Float
              header.writeUInt16LE(1, 22); // Mono
              header.writeUInt32LE(16000, 24);
              header.writeUInt32LE(64000, 28);
              header.writeUInt16LE(4, 32);
              header.writeUInt16LE(32, 34);
              header.write("data", 36);
              header.writeUInt32LE(raw.length, 40);

              fs.writeFileSync(tempWav, Buffer.concat([header, raw]));

              const args = [
                "-m", modelPath,
                "-f", tempWav,
                "-l", lang,
                "-t", "4",
                "--no-timestamps",
              ];
              if (task === "translate") {
                args.push("-tr");
              }

              const binDir = path.dirname(whisperBin);
              const child = spawn(whisperBin, args, {
                cwd: binDir,
                env: {
                  ...process.env,
                  DYLD_LIBRARY_PATH: `${binDir}:${process.env.DYLD_LIBRARY_PATH || ""}`,
                },
              });
              let output = "";
              child.stdout.on("data", (d) => { output += d.toString(); });
              child.on("close", () => {
                try { fs.unlinkSync(tempWav); } catch {}
                const text = output.trim();
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ text }));
              });
              child.on("error", () => {
                try { fs.unlinkSync(tempWav); } catch {}
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ text: "" }));
              });
              return;
            }

            // Fallback: proxy to Python ASR worker
            const targetPath = `/transcribe${incomingUrl.search || ""}`;
            const proxyHeaders: Record<string, string> = {
              "Content-Type": "application/octet-stream",
              "Content-Length": String(raw.length),
            };

            const proxyReq = http.request(
              {
                hostname: "127.0.0.1",
                port: 5174,
                path: targetPath,
                method: "POST",
                headers: proxyHeaders,
              },
              (proxyRes) => {
                res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
                proxyRes.pipe(res);
              }
            );

            proxyReq.on("error", () => {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ text: "" }));
            });

            proxyReq.end(raw);
          });
        });
      },
    },
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: ["es2021", "chrome100", "safari13"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
