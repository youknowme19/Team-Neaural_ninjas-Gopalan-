#!/bin/bash
# One-time download of the local GGUF weights. After this, Clean Up, live
# translation and "Catch me up" run fully offline on this machine.
#
#   scripts/download_models.sh                   # Qwen2.5-0.5B (Clean Up, summaries) + Gemma 3 1B (translation)
#   scripts/download_models.sh --no-translation  # Qwen2.5-0.5B only (~490 MB)
set -e

MODELS_DIR="$(cd "$(dirname "$0")/.." && pwd)/apps/desktop/src-tauri/models"
mkdir -p "$MODELS_DIR"

download() {
  local file="$1" url="$2"
  if [ -f "$MODELS_DIR/$file" ]; then
    echo "$file already present"
    return
  fi
  echo "Downloading $file..."
  curl -L --fail --progress-bar -o "$MODELS_DIR/$file.part" "$url"
  mv "$MODELS_DIR/$file.part" "$MODELS_DIR/$file"
}

# Qwen2.5-0.5B (~490 MB): grammar Clean Up and English summaries
download qwen2.5-0.5b-instruct-q4_k_m.gguf \
  "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"

# Gemma 3 1B (~810 MB): live caption translation (Qwen 0.5B produces unusable Hindi/Tamil)
if [ "$1" != "--no-translation" ]; then
  download gemma-3-1b-it-Q4_K_M.gguf \
    "https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf"
fi

if ! command -v llama-server >/dev/null 2>&1 && [ ! -x "$MODELS_DIR/../bin/llama-server" ]; then
  echo "llama-server not found. Install llama.cpp: brew install llama.cpp"
fi

echo "Models ready in $MODELS_DIR"
