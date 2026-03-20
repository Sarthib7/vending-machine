#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/libtempo.sh"

FORGE_BIN="${FORGE_BIN:-$HOME/.foundry/bin/forge}"
TEMPO_RPC_URL="${TEMPO_RPC_URL:-https://rpc.moderato.tempo.xyz}"
VERIFIER_URL="${VERIFIER_URL:-https://contracts.tempo.xyz}"
TEMPO_FEE_TOKEN="${TEMPO_FEE_TOKEN:-0x20c0000000000000000000000000000000000001}"
CONTRACT_NAME="contracts/VendingMachineLedger.sol:VendingMachineLedger"
root_account="$(normalize_tempo_address "${TEMPO_ROOT_ACCOUNT:-${TEMPO_SENDER:-}}")"
export TEMPO_ROOT_ACCOUNT="$root_account"

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

if [[ -n "${TEMPO_ACCESS_KEY:-}" ]]; then
  if [[ -z "$root_account" ]]; then
    echo "TEMPO_ROOT_ACCOUNT or TEMPO_SENDER is required when using TEMPO_ACCESS_KEY." >&2
    exit 1
  fi
  args+=(--from "$root_account" --tempo.access-key "$TEMPO_ACCESS_KEY" --tempo.root-account "$root_account")
elif [[ -n "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  args+=(--private-key "$DEPLOYER_PRIVATE_KEY")
else
  args+=(--interactive)
fi

printf 'Deploying %s\n' "$CONTRACT_NAME"
printf 'RPC: %s\n' "$TEMPO_RPC_URL"
printf 'Verifier: %s\n' "$VERIFIER_URL"
printf 'Fee token: %s\n' "$TEMPO_FEE_TOKEN"
if [[ -n "$root_account" ]]; then
  printf 'Root account: %s\n' "$root_account"
fi
if [[ -n "${TEMPO_ACCESS_KEY:-}" ]]; then
  printf 'Deploy mode: access-key\n'
elif [[ -n "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  printf 'Deploy mode: private-key\n'
else
  printf 'Deploy mode: interactive signer prompt\n'
fi

exec "$FORGE_BIN" "${args[@]}"
