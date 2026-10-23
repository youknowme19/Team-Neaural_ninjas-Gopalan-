#!/bin/bash
set -e

echo "Building whisper.cpp sidecars..."

# macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    git clone https://github.com/ggerganov/whisper.cpp.git external/whisper.cpp || true
    cd external/whisper.cpp
    cmake -B build -DWHISPER_COREML=ON -DCMAKE_BUILD_TYPE=Release
    cmake --build build --config Release -j
    mkdir -p ../../apps/desktop/src-tauri/bin/
    cp build/bin/whisper-cli ../../apps/desktop/src-tauri/bin/whisper-sidecar-aarch64-apple-darwin
fi

echo "Sidecar setup script complete."
