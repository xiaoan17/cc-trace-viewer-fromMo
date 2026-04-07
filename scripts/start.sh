#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if [ ! -d node_modules ]; then
  echo "Dependencies are missing. Running setup first..."
  bash ./scripts/setup.sh
  echo
fi

exec npm run dev
