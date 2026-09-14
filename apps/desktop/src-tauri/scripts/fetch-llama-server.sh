#!/usr/bin/env bash
set -euo pipefail

# Stages llama.cpp's `llama-server` (+ its runtime .dylib dependencies) as a
# bundled resource so the app can run a local LLM with no external installs
# (no Ollama, no LM Studio). Only macOS/aarch64 is supported today — matches
# this app's only shipping target.
#
# llama-server is NOT statically linked: it loads ~10 sibling libggml-*/
# libllama-*.dylib files via `@loader_path` (same directory as the binary
# itself), so the whole directory ships together as one `bundle.resources`
# entry (resources/llama-server-bin -> llama-server-bin in the app bundle)
# rather than as a single-file `externalBin` sidecar.
#
# Usage: ./fetch-llama-server.sh
# Safe to re-run — skips the download if the pinned version is already staged.

LLAMA_CPP_TAG="b10750"
EXPECTED_SHA256="8efa71cc28ad89a8108949723dcb74940910ee35f3deb59b4417e4eb51b053b2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_TAURI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST_DIR="$SRC_TAURI_DIR/resources/llama-server-bin"

if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "[fetch-llama-server] Non-macOS/arm64 host detected, skipping (app only ships aarch64-apple-darwin)."
  exit 0
fi

STAMP_FILE="$SRC_TAURI_DIR/resources/.llama-server-bin.stamp"
STAMP="${LLAMA_CPP_TAG}-deps-only"

if [ -x "$DEST_DIR/llama-server" ] && [ "$(cat "$STAMP_FILE" 2>/dev/null)" = "$STAMP" ]; then
  echo "[fetch-llama-server] Already staged, skipping."
  exit 0
fi

ASSET="llama-${LLAMA_CPP_TAG}-bin-macos-arm64.tar.gz"
URL="https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_TAG}/${ASSET}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "[fetch-llama-server] Downloading $URL"
curl -fsSL -o "$WORKDIR/$ASSET" "$URL"

ACTUAL_SHA256="$(shasum -a 256 "$WORKDIR/$ASSET" | awk '{print $1}')"
if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
  echo "[fetch-llama-server] Checksum mismatch!" >&2
  echo "[fetch-llama-server]   expected: $EXPECTED_SHA256" >&2
  echo "[fetch-llama-server]   actual:   $ACTUAL_SHA256" >&2
  exit 1
fi

tar -xzf "$WORKDIR/$ASSET" -C "$WORKDIR"
EXTRACTED_DIR="$WORKDIR/llama-${LLAMA_CPP_TAG}"
if [ ! -x "$EXTRACTED_DIR/llama-server" ]; then
  echo "[fetch-llama-server] llama-server binary not found in release archive." >&2
  exit 1
fi

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

# Tauri bundles resources by following symlinks, so the archive's versioned
# chain (libfoo.dylib -> libfoo.0.dylib -> libfoo.0.x.y.dylib) landed in the
# app as three full copies of every library. Ship each library once, under the
# exact @rpath name the loader asks for, and only the libraries llama-server
# actually loads: the archive's bench, perplexity and quantize tool libraries
# are never loaded by it.
cp "$EXTRACTED_DIR/llama-server" "$DEST_DIR/llama-server"
chmod +x "$DEST_DIR/llama-server"

queue=("llama-server")
seen=" llama-server "
while [ ${#queue[@]} -gt 0 ]; do
  current="${queue[0]}"
  queue=("${queue[@]:1}")
  while IFS= read -r dep; do
    [ -n "$dep" ] || continue
    case "$seen" in *" $dep "*) continue ;; esac
    seen="$seen$dep "
    if [ ! -e "$EXTRACTED_DIR/$dep" ]; then
      echo "[fetch-llama-server] Missing dependency in archive: $dep" >&2
      exit 1
    fi
    cp -L "$EXTRACTED_DIR/$dep" "$DEST_DIR/$dep"
    queue+=("$dep")
  done < <(otool -L "$DEST_DIR/$current" | awk 'NR>1 {print $1}' | sed -n 's|^@rpath/||p')
done

# Fail the build rather than ship an engine that cannot load its libraries.
if ! "$DEST_DIR/llama-server" --version >/dev/null 2>&1; then
  echo "[fetch-llama-server] Staged llama-server failed to start." >&2
  exit 1
fi

echo "$STAMP" > "$STAMP_FILE"

echo "[fetch-llama-server] Staged: $DEST_DIR ($(du -sh "$DEST_DIR" | cut -f1))"
