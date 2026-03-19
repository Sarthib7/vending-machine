#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${TEMPO_RPC_URL:-}" ]]; then
  echo "TEMPO_RPC_URL is required" >&2
  exit 1
fi

if [[ -z "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  echo "DEPLOYER_PRIVATE_KEY is required" >&2
  exit 1
fi

forge create contracts/VendingMachineLedger.sol:VendingMachineLedger \
  --rpc-url "$TEMPO_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY"
