#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec npm run dev --workspace @genshin-dps-lab/web -- --host 127.0.0.1 --port 4179 --strictPort
