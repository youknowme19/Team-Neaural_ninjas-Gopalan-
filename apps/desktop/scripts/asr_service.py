import sys
import json
import zlib
import re
import numpy as np
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import torch
from transformers import pipeline

print("Initializing accelerated Whisper ASR pipeline on Apple Silicon...")
device = "mps" if torch.backends.mps.is_available() else "cpu"
dtype = torch.float16 if device == "mps" else torch.float32

asr = pipeline(
    "automatic-speech-recognition",
    model="openai/whisper-tiny",
    device=device,
    dtype=dtype,
)

# Pre-compile Metal shaders with warmup pass for 0ms cold-start latency
print("Warming up Apple Silicon Metal GPU shaders...")
warmup_dummy = np.zeros(16000, dtype=np.float32)
with torch.inference_mode():
    asr(
        {"sampling_rate": 16000, "raw": warmup_dummy},
        generate_kwargs={
            "task": "transcribe",
            "language": "en",
            "no_repeat_ngram_size": 3,
            "repetition_penalty": 1.3,
        },
    )
print(f"Whisper ASR ready on device: {device} ({dtype}) with zero-latency pre-compilation")

HALLUCINATION_EXACT = {
    ".", "..", "...", "you", "Thank you.", "Thank you", "bye", "Bye.",
    "Subtitle by", "[music]", "(music)", "music", "[applause]", "(applause)",
    "Thanks for watching!", "Please subscribe", "MBC 뉴스",
}

def is_clean_transcript(text: str) -> bool:
    if not text or len(text.strip()) < 3:
        return False

    cleaned = text.strip()
    if cleaned in HALLUCINATION_EXACT:
        return False

    # Foreign non-Latin script filter (Korean, Chinese, Japanese, Cyrillic, Arabic)
    if re.search(r'[\uac00-\ud7af\u1100-\u11ff\u3040-\u30ff\u4e00-\u9fff\u0600-\u06ff\u0400-\u04ff]', cleaned):
        return False

    # Excessive character repetitions (e.g. '........' or 'haaaa')
    if re.search(r'(.)\1{3,}', cleaned):
        return False

    # Zlib compression ratio (detects loops like "Good morning. Good morning. Good morning...")
    raw = cleaned.encode("utf-8")
    if len(raw) > 24:
        ratio = len(raw) / len(zlib.compress(raw))
        if ratio > 2.0:
            return False

    # Word diversity ratio (detects phrase repetitions like "killing, killing, killing...")
    words = cleaned.split()
    if len(words) >= 4:
        if len(set(words)) / len(words) < 0.45:
            return False

    return True

class FastASRHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_POST(self):
        if self.path == "/transcribe":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"text":""}')
                return

            body = self.rfile.read(content_length)

            # Ignore tiny fragments (< 0.25s of audio)
            if len(body) < 16000 * 0.25 * 4:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"text":""}')
                return

            audio_data = np.frombuffer(body, dtype=np.float32)

            # Fast energy check: skip silence in 0.01ms without GPU overhead
            max_amp = float(np.max(np.abs(audio_data)))
            if max_amp < 0.012:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"text":""}')
                return

            try:
                with torch.inference_mode():
                    result = asr(
                        {"sampling_rate": 16000, "raw": audio_data},
                        generate_kwargs={
                            "task": "transcribe",
                            "language": "en",
                            "no_repeat_ngram_size": 3,
                            "repetition_penalty": 1.3,
                            "condition_on_previous_text": False,
                        },
                    )

                text = result.get("text", "").strip()
                if not is_clean_transcript(text):
                    text = ""

                resp = json.dumps({"text": text}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(resp)
            except Exception as e:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e), "text": ""}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def run(port=5174):
    server = ThreadingHTTPServer(("127.0.0.1", port), FastASRHandler)
    print(f"High-Performance ASR Server listening on http://127.0.0.1:{port}")
    sys.stdout.flush()
    server.serve_forever()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5174
    run(port)
