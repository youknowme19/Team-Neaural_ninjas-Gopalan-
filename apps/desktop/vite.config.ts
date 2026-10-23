import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { execSync } from 'child_process';
import { broadcastHubPlugin } from './server/broadcastHub';

function activeWindowsPlugin(): Plugin {
  return {
    name: 'active-windows-provider',
    configureServer(server) {
      server.middlewares.use('/api/windows', (_req, res) => {
        try {
          const output = execSync(
            `ps -eo pid,command | grep -E "^ *[0-9]+ +(/Applications/|/System/Applications/).*\\.app/Contents/MacOS/" | grep -v "Helper"`
          ).toString();

          const windows = output
            .split('\n')
            .filter((line) => line.trim().length > 0)
            .map((line) => {
              const match = line.trim().match(/^([0-9]+)\s+(.*)$/);
              if (!match) return null;
              const pid = parseInt(match[1], 10);
              const cmd = match[2];
              const appMatch = cmd.match(/\/([^/]+)\.app/);
              const appName = appMatch ? appMatch[1] : 'Application';
              return {
                process_id: pid,
                window_name: `${appName} (PID: ${pid})`,
                app_name: appName,
              };
            })
            .filter(Boolean);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(windows));
        } catch {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify([]));
        }
      });

      server.middlewares.use('/api/lan-ip', (_req, res) => {
        try {
          const ip = execSync('ipconfig getifaddr en0 || ipconfig getifaddr en1 || hostname -I | awk "{print $1}"')
            .toString()
            .trim();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ip: ip || '192.168.56.198' }));
        } catch {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ip: '192.168.56.198' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), basicSsl(), activeWindowsPlugin(), broadcastHubPlugin()],
  clearScreen: false,
  server: {
    host: '0.0.0.0',
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
