#!/usr/bin/env bash
# Thin wrapper around scripts/sync-everything.py. See docs/CHANGE-SYNC.md.
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 scripts/sync-everything.py "$@"
