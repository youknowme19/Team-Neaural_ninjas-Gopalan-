import sys
import json
import numpy as np
from http.server import HTTPServer, BaseHTTPRequestHandler
import torch
from transformers import pipeline

print("Loading Whisper ASR pipeline on Apple Silicon GPU...")
device = "mps" if torch.backends.mps.is_available() else "cpu"
asr = pipeline(
    "automatic-speech-recognition",
    model="openai/whisper-tiny",
    device=device,
    torch_dtype=torch.float32,
)
print("Whisper ASR ready on device:", device)

class ASRHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_POST(self):
        if self.path == "/transcribe":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            if len(body) < 1600:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"text":""}')
                return

            audio_data = np.frombuffer(body, dtype=np.float32)

            # Silence rejection: if maximum amplitude is negligible, skip inference
            max_amp = float(np.max(np.abs(audio_data)))
            if max_amp < 0.01:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"text":""}')
                return

            try:
                result = asr({"sampling_rate": 16000, "raw": audio_data})
                text = result.get("text", "").strip()
                # Clean up whisper artifact tokens
                if text in [".", "you", "Thank you.", "Thank you", "bye", "Bye."]:
                    text = ""

                resp = json.dumps({"text": text}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(resp)
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def run(port=5174):
    server = HTTPServer(("127.0.0.1", port), ASRHandler)
    print(f"ASR Server listening on http://127.0.0.1:{port}")
    sys.stdout.flush()
    server.serve_forever()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5174
    run(port)
