#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8080}"
echo "提瓦特伤害实验室：http://localhost:${PORT}"
python3 -m http.server "$PORT"
