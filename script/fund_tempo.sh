#!/usr/bin/env bash
set -euo pipefail

CAST_BIN="${CAST_BIN:-$HOME/.foundry/bin/cast}"
TEMPO_RPC_URL="${TEMPO_RPC_URL:-https://rpc.moderato.tempo.xyz}"
sender="${TEMPO_SENDER:-}"

if [[ "$sender" == tempox0x* ]]; then
  sender="${sender#tempox}"
fi

if [[ ! -x "$CAST_BIN" ]]; then
  echo "Tempo Foundry cast binary not found at $CAST_BIN. Run foundryup -n tempo first." >&2
  exit 1
fi

if [[ -z "$sender" ]]; then
  echo "TEMPO_SENDER is required." >&2
  echo "Set it to the tempox0x... or 0x... address returned by tempo wallet -t whoami." >&2
  exit 1
fi

printf 'Requesting Moderato faucet funds for %s\n' "$sender"
exec "$CAST_BIN" rpc tempo_fundAddress "$sender" --rpc-url "$TEMPO_RPC_URL"
