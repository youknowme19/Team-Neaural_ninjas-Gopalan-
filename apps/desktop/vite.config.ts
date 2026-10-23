import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "child_process";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "screencapture-bridge-api",
      configureServer(server) {
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
