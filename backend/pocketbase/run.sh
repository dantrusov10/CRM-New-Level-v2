#!/usr/bin/env bash
set -euo pipefail
PB_BIN="${PB_BIN:-./pb}"

if [ ! -f "$PB_BIN" ]; then
  echo "PocketBase binary not found at $PB_BIN"
  exit 1
fi

mkdir -p ./pb_data
"$PB_BIN" serve --http 127.0.0.1:8090 --dir ./pb_data
