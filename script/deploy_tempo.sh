#!/usr/bin/env bash
set -euo pipefail

FORGE_BIN="${FORGE_BIN:-$HOME/.foundry/bin/forge}"
TEMPO_RPC_URL="${TEMPO_RPC_URL:-https://rpc.moderato.tempo.xyz}"
VERIFIER_URL="${VERIFIER_URL:-https://contracts.tempo.xyz}"
TEMPO_FEE_TOKEN="${TEMPO_FEE_TOKEN:-0x20c0000000000000000000000000000000000001}"
CONTRACT_NAME="contracts/VendingMachineLedger.sol:VendingMachineLedger"

if [[ ! -x "$FORGE_BIN" ]]; then
  echo "Tempo Foundry forge binary not found at $FORGE_BIN. Run foundryup -n tempo first." >&2
  exit 1
fi

args=(
  create
  "$CONTRACT_NAME"
  --rpc-url
  "$TEMPO_RPC_URL"
  --verifier-url
  "$VERIFIER_URL"
  --tempo.fee-token
  "$TEMPO_FEE_TOKEN"
  --broadcast
  --verify
  --retries
  10
  --delay
  10
)

if [[ -n "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  args+=(--private-key "$DEPLOYER_PRIVATE_KEY")
else
  args+=(--interactive)
  if [[ -n "${TEMPO_SENDER:-}" ]]; then
    args+=(--sender "$TEMPO_SENDER")
  fi
fi

printf 'Deploying %s\n' "$CONTRACT_NAME"
printf 'RPC: %s\n' "$TEMPO_RPC_URL"
printf 'Verifier: %s\n' "$VERIFIER_URL"
printf 'Fee token: %s\n' "$TEMPO_FEE_TOKEN"
if [[ -n "${TEMPO_SENDER:-}" ]]; then
  printf 'Sender: %s\n' "$TEMPO_SENDER"
fi

exec "$FORGE_BIN" "${args[@]}"
