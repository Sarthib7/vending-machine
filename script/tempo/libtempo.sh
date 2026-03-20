#!/usr/bin/env bash

normalize_tempo_address() {
  local value="${1:-}"

  if [[ -z "$value" ]]; then
    printf '\n'
    return 0
  fi

  if [[ "$value" == tempox0x* ]]; then
    value="${value#tempox}"
  fi

  if [[ ! "$value" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
    printf 'Invalid Tempo address: %s\n' "$1" >&2
    return 1
  fi

  printf '%s\n' "$value"
}
