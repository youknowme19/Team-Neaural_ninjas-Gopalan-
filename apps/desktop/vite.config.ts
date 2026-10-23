import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "child_process";
import path from "path";
import http from "http";

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

        // Endpoint 3: Direct digital screen audio chunk transcription (Zero mic noise)
        server.middlewares.use("/api/screencapture/transcribe-chunk", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }

          const incomingUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
          const targetPath = `/transcribe${incomingUrl.search || ""}`;

          const proxyReq = http.request(
            {
              hostname: "127.0.0.1",
              port: 5174,
              path: targetPath,
              method: "POST",
              headers: {
                "Content-Type": "application/octet-stream",
                "Content-Length": req.headers["content-length"] || "",
              },
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

          req.pipe(proxyReq);
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
