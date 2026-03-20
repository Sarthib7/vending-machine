#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/libtempo.sh"

CAST_BIN="${CAST_BIN:-$HOME/.foundry/bin/cast}"
TEMPO_RPC_URL="${TEMPO_RPC_URL:-https://rpc.moderato.tempo.xyz}"
TEMPO_FEE_TOKEN="${TEMPO_FEE_TOKEN:-0x20c0000000000000000000000000000000000001}"
ACCOUNT_KEYCHAIN="0xAAAAAAAA00000000000000000000000000000000"
root_account="$(normalize_tempo_address "${TEMPO_ROOT_ACCOUNT:-${TEMPO_SENDER:-}}")"
export TEMPO_ROOT_ACCOUNT="$root_account"

if [[ ! -x "$CAST_BIN" ]]; then
  echo "Tempo Foundry cast binary not found at $CAST_BIN. Run foundryup -n tempo first." >&2
  exit 1
fi

if [[ -z "${TEMPO_ACCESS_KEY:-}" ]]; then
  echo "TEMPO_ACCESS_KEY is required." >&2
  echo "Generate one with: npm run tempo:access-key:new" >&2
  exit 1
fi

if [[ -z "$root_account" ]]; then
  echo "TEMPO_ROOT_ACCOUNT or TEMPO_SENDER is required." >&2
  exit 1
fi

access_key_address="$("$CAST_BIN" wallet address "$TEMPO_ACCESS_KEY")"
access_key_expiry="${TEMPO_ACCESS_KEY_EXPIRY:-0}"
enforce_limits="${TEMPO_ACCESS_KEY_ENFORCE_LIMITS:-false}"
limits="${TEMPO_ACCESS_KEY_LIMITS:-[]}"

args=(
  send
  "$ACCOUNT_KEYCHAIN"
  "authorizeKey(address,uint8,uint64,bool,(address,uint256)[])"
  "$access_key_address"
  0
  "$access_key_expiry"
  "$enforce_limits"
  "$limits"
  --rpc-url
  "$TEMPO_RPC_URL"
  --tempo.fee-token
  "$TEMPO_FEE_TOKEN"
)

if [[ -n "${ROOT_PRIVATE_KEY:-}" ]]; then
  args+=(--private-key "$ROOT_PRIVATE_KEY")
elif [[ "${TEMPO_BROWSER_WALLET:-0}" == "1" ]]; then
  args+=(--browser --from "$root_account")
else
  echo "A root-account signer is required to authorize an access key." >&2
  echo "Set ROOT_PRIVATE_KEY, or set TEMPO_BROWSER_WALLET=1 to try browser-wallet signing." >&2
  exit 1
fi

printf 'Authorizing access key %s for root account %s\n' "$access_key_address" "$root_account"
printf 'RPC: %s\n' "$TEMPO_RPC_URL"
printf 'Fee token: %s\n' "$TEMPO_FEE_TOKEN"
printf 'Expiry: %s\n' "$access_key_expiry"
printf 'Enforce limits: %s\n' "$enforce_limits"
exec "$CAST_BIN" "${args[@]}"
