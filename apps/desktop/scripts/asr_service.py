import sys
import json
import zlib
import re
import urllib.parse
import numpy as np
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import torch
from transformers import pipeline

print("Initializing multilingual Whisper ASR pipeline on Apple Silicon...")
device = "mps" if torch.backends.mps.is_available() else "cpu"
dtype = torch.float16 if device == "mps" else torch.float32

asr = pipeline(
    "automatic-speech-recognition",
    model="openai/whisper-tiny",
    device=device,
    dtype=dtype,
)

# Warm up Metal GPU shaders for zero-latency execution
print("Warming up Apple Silicon Metal GPU shaders...")
warmup_dummy = np.zeros(16000, dtype=np.float32)
with torch.inference_mode():
    asr(
        {"sampling_rate": 16000, "raw": warmup_dummy},
        generate_kwargs={"task": "transcribe"},
    )
print(f"Whisper Multilingual ASR ready on device: {device} ({dtype})")

HALLUCINATION_EXACT = {
    ".", "..", "...", "you", "Thank you.", "Thank you", "bye", "Bye.",
    "Subtitle by", "[music]", "(music)", "music", "[applause]", "(applause)",
    "Thanks for watching!", "Please subscribe", "MBC News",
}

def deduplicate_repetitions(text: str) -> str:
    # 1. Deduplicate single repeated words (Latin and Devanagari)
    cleaned = re.sub(r'\b(\w+)[,\.]?(?:\s+\1[,\.]?)+\b', r'\1', text, flags=re.IGNORECASE | re.UNICODE)
    # 2. Devanagari specific single-word repetition
    cleaned = re.sub(r'(?:^|\s)([\u0900-\u097f]+[,\.]?)(?:\s+\1[,\.]?)+(?=\s|$)', r' \1', cleaned)
    # 3. Deduplicate 2-word phrase repetitions
    cleaned = re.sub(r'(\b\w+\s+\w+[\.,?!]?)(?:\s+\1)+', r'\1', cleaned, flags=re.IGNORECASE | re.UNICODE)
    # 4. Deduplicate 3-word phrase repetitions
    cleaned = re.sub(r'(\b\w+\s+\w+\s+\w+[\.,?!]?)(?:\s+\1)+', r'\1', cleaned, flags=re.IGNORECASE | re.UNICODE)
    # 5. Collapse excessive dots
    cleaned = re.sub(r'\.{3,}', '...', cleaned)
    return cleaned.strip()

def is_clean_transcript(text: str) -> bool:
    if not text or len(text.strip()) < 2:
        return False

    cleaned = text.strip()
    if cleaned in HALLUCINATION_EXACT:
        return False

    # Foreign hallucinated Asian script filter on non-Asian speech
    # Rejects Korean, Chinese, Japanese glyphs that Whisper hallucinates on background silence
    if re.search(r'[\uac00-\ud7af\u1100-\u11ff\u3040-\u30ff\u4e00-\u9fff]', cleaned):
        return False

    # Excessive character repetitions
    if re.search(r'(.)\1{4,}', cleaned):
        return False

    # Zlib compression ratio test for autoregressive repetition loops
    raw = cleaned.encode("utf-8")
    if len(raw) > 28:
        ratio = len(raw) / len(zlib.compress(raw))
        if ratio > 2.2:
            return False

    return True

class FastASRHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/transcribe":
            query = urllib.parse.parse_qs(parsed.query)
            lang = query.get("lang", ["auto"])[0]
            task = query.get("task", ["transcribe"])[0]

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
                generate_kwargs = {
                    "task": task,
                    "no_repeat_ngram_size": 3,
                    "repetition_penalty": 1.3,
                    "condition_on_previous_text": False,
                }
                if lang and lang != "auto":
                    generate_kwargs["language"] = lang

                with torch.inference_mode():
                    result = asr(
                        {"sampling_rate": 16000, "raw": audio_data},
                        generate_kwargs=generate_kwargs,
                    )

                raw_text = result.get("text", "").strip()
                cleaned_text = deduplicate_repetitions(raw_text)

                if not is_clean_transcript(cleaned_text):
                    cleaned_text = ""

                resp = json.dumps({"text": cleaned_text}).encode("utf-8")
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
    print(f"High-Performance Multilingual ASR Server listening on http://127.0.0.1:{port}")
    sys.stdout.flush()
    server.serve_forever()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5174
    run(port)
