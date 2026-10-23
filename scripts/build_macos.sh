#!/usr/bin/env bash
set -euo pipefail

# LiveSpeak macOS Native Build & Assembly Pipeline
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${REPO_ROOT}/apps/desktop/src-tauri/bin"
MODELS_DIR="${REPO_ROOT}/apps/desktop/src-tauri/models"
WHISPER_SRC="${REPO_ROOT}/whisper.cpp"
SWIFT_SRC="${REPO_ROOT}/apps/desktop/src-tauri/native/ScreenCaptureBridge.swift"

echo "[LiveSpeak macOS] Building native components..."
mkdir -p "${BIN_DIR}" "${MODELS_DIR}"

# 1. Compile Apple ScreenCaptureKit Native Audio & Window Bridge
if [ -f "${SWIFT_SRC}" ]; then
  echo "[LiveSpeak macOS] Compiling ScreenCaptureBridge.swift with ScreenCaptureKit..."
  swiftc -O -parse-as-library \
    -framework ScreenCaptureKit \
    -framework CoreGraphics \
    -framework AVFoundation \
    -framework Speech \
    "${SWIFT_SRC}" \
    -o "${BIN_DIR}/screencapture-bridge"
  chmod +x "${BIN_DIR}/screencapture-bridge"
  echo "[LiveSpeak macOS] screencapture-bridge built successfully."
fi

# 2. Compile whisper.cpp with Metal GPU Acceleration
if [ ! -d "${WHISPER_SRC}" ]; then
  echo "[LiveSpeak macOS] Cloning whisper.cpp repository..."
  git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "${WHISPER_SRC}"
fi

mkdir -p "${WHISPER_SRC}/build"
cd "${WHISPER_SRC}/build"
echo "[LiveSpeak macOS] Configuring CMake with Metal GPU acceleration..."
cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DGGML_METAL=ON \
  -DWHISPER_BUILD_TESTS=OFF \
  -DWHISPER_BUILD_EXAMPLES=ON

echo "[LiveSpeak macOS] Building whisper-server and whisper-cli..."
cmake --build . --config Release --target whisper-server -j$(sysctl -n hw.ncpu)
cmake --build . --config Release --target whisper-cli -j$(sysctl -n hw.ncpu)

cp bin/whisper-server "${BIN_DIR}/whisper-server"
cp bin/whisper-cli "${BIN_DIR}/whisper-cli"
cp bin/whisper-cli "${BIN_DIR}/whisper-sidecar-aarch64-apple-darwin"
cp bin/*.dylib "${BIN_DIR}/" 2>/dev/null || true
chmod +x "${BIN_DIR}/whisper-server" "${BIN_DIR}/whisper-cli" "${BIN_DIR}/whisper-sidecar-aarch64-apple-darwin"

# 3. Download Multilingual Model (ggml-tiny.bin) if missing
cd "${REPO_ROOT}"
if [ ! -f "${MODELS_DIR}/ggml-tiny.bin" ]; then
  echo "[LiveSpeak macOS] Downloading ggml-tiny.bin multilingual model..."
  curl -L -o "${MODELS_DIR}/ggml-tiny.bin" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
fi

# 4. Build Desktop Frontend
echo "[LiveSpeak macOS] Building desktop frontend..."
cd "${REPO_ROOT}/apps/desktop"
pnpm build

echo "[LiveSpeak macOS] Native macOS build completed successfully."
