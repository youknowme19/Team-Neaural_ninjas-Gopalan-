#!/usr/bin/env bash
set -euo pipefail

mkdir -p apps/desktop/src-tauri/bin

echo "Compiling native macOS ScreenCaptureBridge from Swift..."
swiftc -O -parse-as-library -target arm64-apple-macosx13.0 \
  apps/desktop/src-tauri/native/ScreenCaptureBridge.swift \
  -o apps/desktop/src-tauri/bin/screencapture-bridge \
  -framework ScreenCaptureKit \
  -framework CoreGraphics \
  -framework AVFoundation

echo "ScreenCaptureBridge compiled successfully to apps/desktop/src-tauri/bin/screencapture-bridge"
