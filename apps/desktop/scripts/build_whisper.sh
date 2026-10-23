#!/usr/bin/env bash
set -euo pipefail

# Build whisper.cpp with Apple Silicon Metal acceleration on /Volumes/SSD
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WHISPER_SRC="${REPO_ROOT}/whisper.cpp"
BIN_DIR="${REPO_ROOT}/apps/desktop/src-tauri/bin"
MODEL_DIR="${REPO_ROOT}/apps/desktop/src-tauri/models"

echo "[whisper-build] Repo root: ${REPO_ROOT}"

if [ ! -d "${WHISPER_SRC}" ]; then
  echo "[whisper-build] Cloning whisper.cpp into ${WHISPER_SRC}..."
  git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "${WHISPER_SRC}"
fi

mkdir -p "${WHISPER_SRC}/build"
cd "${WHISPER_SRC}/build"

echo "[whisper-build] Configuring CMake with Metal GPU acceleration..."
cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DGGML_METAL=ON \
  -DWHISPER_BUILD_TESTS=OFF \
  -DWHISPER_BUILD_EXAMPLES=ON

echo "[whisper-build] Compiling whisper-cli..."
cmake --build . --config Release --target whisper-cli -j$(sysctl -n hw.ncpu)

mkdir -p "${BIN_DIR}"
echo "[whisper-build] Installing binaries and dynamic libraries to ${BIN_DIR}..."
cp bin/whisper-cli "${BIN_DIR}/whisper-cli"
cp bin/whisper-cli "${BIN_DIR}/whisper-sidecar-aarch64-apple-darwin"
cp bin/*.dylib "${BIN_DIR}/" 2>/dev/null || true

mkdir -p "${MODEL_DIR}"
if [ ! -f "${MODEL_DIR}/ggml-tiny.bin" ]; then
  echo "[whisper-build] Downloading multilingual ggml-tiny.bin to ${MODEL_DIR}..."
  curl -L -o "${MODEL_DIR}/ggml-tiny.bin" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
fi

echo "[whisper-build] whisper.cpp Metal build complete and installed."
