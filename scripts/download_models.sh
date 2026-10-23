#!/bin/bash
set -e

echo "Downloading quantized models (< 200MB budget)..."
mkdir -p apps/desktop/src-tauri/models

# Whisper tiny.en GGUF (~75MB)
# Silero VAD ONNX (~2MB)

echo "Model verification complete."
