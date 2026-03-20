#!/usr/bin/env bash
set -euo pipefail

CAST_BIN="${CAST_BIN:-$HOME/.foundry/bin/cast}"

if [[ ! -x "$CAST_BIN" ]]; then
  echo "Tempo Foundry cast binary not found at $CAST_BIN. Run foundryup -n tempo first." >&2
  exit 1
fi

"$CAST_BIN" wallet new
