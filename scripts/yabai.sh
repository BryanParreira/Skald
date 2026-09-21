#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

app_notiz=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --app-notiz)
      app_notiz="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -n "$app_notiz" ]]; then
  "$SCRIPT_DIR/yabai_impl.sh" --bundle-id "$app_notiz" --position left
fi
