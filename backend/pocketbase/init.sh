#!/usr/bin/env bash
set -euo pipefail
PB_BIN="${PB_BIN:-./pb}"

if [ ! -f "$PB_BIN" ]; then
  echo "PocketBase binary not found at $PB_BIN"
  echo "Download PocketBase for your OS and place it here as ./pb (chmod +x)."
  exit 1
fi

mkdir -p ./pb_data
# import collections (idempotent for initial setup)
"$PB_BIN" migrate collections import ./collections.json --dir ./pb_data || true

echo "✅ Collections imported. Next: ./run.sh"
