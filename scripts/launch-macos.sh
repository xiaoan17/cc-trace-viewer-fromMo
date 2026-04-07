#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_URL="http://localhost:5173"

cd "$ROOT_DIR"

wait_for_app() {
  for _ in $(seq 1 90); do
    if curl -fsS "$APP_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

(
  if wait_for_app; then
    open "$APP_URL"
  fi
) >/dev/null 2>&1 &

exec bash ./scripts/start.sh
