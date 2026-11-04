#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
node "$ROOT/scripts/build-ide.mjs" --target "linux-${INFERNUM_ARCH:-x64}"
