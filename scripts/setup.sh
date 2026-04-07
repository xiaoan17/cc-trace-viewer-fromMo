#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found in PATH."
  echo "Install Node.js 18+ first, then rerun this script."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found in PATH."
  echo "Install Node.js 18+ first, then rerun this script."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(\".\")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js 18+ is required. Current version: $(node -v)"
  exit 1
fi

echo "Installing dependencies..."
npm install

echo
echo "Setup complete."
echo "Run 'npm start' to launch Trace Viewer."
