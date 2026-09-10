#!/usr/bin/env bash
set -euo pipefail

# llama.cpp's release binaries ship ad-hoc signed (no Developer ID, no secure
# timestamp) — fine for local use, but Apple's notarization service rejects
# every unsigned/ad-hoc binary inside the bundle, not just the main app.
# Since llama-server + its .dylib dependencies ship via `bundle.resources`
# (not `externalBin`), Tauri's own auto-signing pass never touches them —
# this closes that gap by re-signing each one with the real Developer ID
# identity before packaging.
#
# Runs as part of `beforeBundleCommand` (see before-bundle.mjs), after
# fetch-llama-server.sh has staged the binaries but before Tauri notarizes
# the .app. No-ops cleanly if the directory or signing identity isn't
# present (e.g. local `tauri dev`, or unsigned dev builds).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/../resources/llama-server-bin"

if [ "$(uname -s)" != "Darwin" ]; then
  exit 0
fi

if [ ! -d "$BIN_DIR" ]; then
  echo "[sign-llama-server-bin] No llama-server-bin directory, skipping."
  exit 0
fi

if [ -z "${APPLE_SIGNING_IDENTITY:-}" ]; then
  echo "[sign-llama-server-bin] APPLE_SIGNING_IDENTITY not set, skipping (fine for unsigned/dev builds; notarization will fail without it)."
  exit 0
fi

echo "[sign-llama-server-bin] Signing with identity: $APPLE_SIGNING_IDENTITY"

# Only real files, not the versioned-symlink chain (e.g. libggml.dylib ->
# libggml.0.dylib -> libggml.0.22.0.dylib) — signing the target file once
# is sufficient, and codesign errors on some symlink forms.
find "$BIN_DIR" -type f | while IFS= read -r file; do
  codesign --force --sign "$APPLE_SIGNING_IDENTITY" --timestamp --options runtime "$file"
  echo "[sign-llama-server-bin]   signed: $(basename "$file")"
done

echo "[sign-llama-server-bin] Done."
