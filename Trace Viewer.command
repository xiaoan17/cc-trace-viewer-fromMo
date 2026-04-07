#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT_DIR"

echo "Launching Trace Viewer..."
echo

bash ./scripts/launch-macos.sh
