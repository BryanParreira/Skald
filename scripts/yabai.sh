#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

app_skald=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --app-skald)
      app_skald="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -n "$app_skald" ]]; then
  "$SCRIPT_DIR/yabai_impl.sh" --bundle-id "$app_skald" --position left
fi
