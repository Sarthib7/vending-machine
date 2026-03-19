#!/usr/bin/env bash
set -euo pipefail

CAST_BIN="${CAST_BIN:-$HOME/.foundry/bin/cast}"
TEMPO_RPC_URL="${TEMPO_RPC_URL:-https://rpc.moderato.tempo.xyz}"
TEMPO_PATH_USD="${TEMPO_CURRENCY:-0x20c0000000000000000000000000000000000000}"
TEMPO_ALPHA_USD="${TEMPO_FEE_TOKEN:-0x20c0000000000000000000000000000000000001}"

if [[ ! -x "$CAST_BIN" ]]; then
  echo "Tempo Foundry cast binary not found at $CAST_BIN. Run foundryup -n tempo first." >&2
  exit 1
fi

if [[ -z "${TEMPO_SENDER:-}" ]]; then
  echo "TEMPO_SENDER is required." >&2
  echo "Set it to the 0x address returned by tempo wallet -t whoami." >&2
  exit 1
fi

printf 'Chain ID: '
"$CAST_BIN" chain-id --rpc-url "$TEMPO_RPC_URL"
printf 'PATHUSD (%s): ' "$TEMPO_PATH_USD"
"$CAST_BIN" erc20 balance "$TEMPO_PATH_USD" "$TEMPO_SENDER" --rpc-url "$TEMPO_RPC_URL"
printf 'ALPHAUSD (%s): ' "$TEMPO_ALPHA_USD"
exec "$CAST_BIN" erc20 balance "$TEMPO_ALPHA_USD" "$TEMPO_SENDER" --rpc-url "$TEMPO_RPC_URL"
