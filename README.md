# The Vending Machine MVP

A backend-only MVP for the Vending Machine procurement engine in [vending-machine-plan.md](/Users/sarthiborkar/Build/vending-machine/vending-machine-plan.md).

This build is intentionally narrow:

- no UI
- no frontend
- one paid HTTP endpoint using MPP on Tempo
- one local stdio MCP server using the same routing and ranking engine

## What works

- `POST /api/v1/vend` is payment-gated with MPP using `mppx`
- `GET /api/v1/vend/:id` returns completed vend records
- `GET /api/v1/providers` and `POST /api/v1/providers` manage the mock provider registry
- `src/mcp-server.ts` exposes `vend_query`, `get_vend_status`, and `list_providers`
- the vend flow classifies the query, filters providers by category, budget, and reputation, ranks offers, auto-selects the winner, and returns the result

## Stack

- Node.js 22
- TypeScript
- Hono
- `mppx` for MPP charge flow on Tempo
- Tempo CLI for client-side paid requests

## Install

```bash
npm install
```

## Tempo setup

Tempo CLI is installed at `"$HOME/.tempo/bin/tempo"`.

Install the required CLI extensions:

```bash
"$HOME/.tempo/bin/tempo" add wallet
"$HOME/.tempo/bin/tempo" add request
```

Finish the wallet setup:

```bash
"$HOME/.tempo/bin/tempo" wallet login
"$HOME/.tempo/bin/tempo" wallet -t whoami
```

Then configure a recipient address for the API. For the MVP, the simplest option is to use your own Tempo wallet address:

```bash
export TEMPO_RECIPIENT=0xYOUR_TEMPO_ADDRESS
```

Optional settings:

```bash
export TEMPO_CURRENCY=0x20c0000000000000000000000000000000000000
export PORT=3000
```

`TEMPO_CURRENCY` defaults to PathUSD on Tempo testnet.

## Run

HTTP API:

```bash
npm run dev:http
```

MCP server:

```bash
npm run dev:mcp
```

## Paid vend flow

The vend endpoint is MPP-gated. Use `tempo request` so the client handles the `402 Payment Required` challenge, submits payment, and retries automatically.

Preview the charge without paying:

```bash
"$HOME/.tempo/bin/tempo" request -t --dry-run -X POST \
  --json '{
    "query":"Screen Acme Corp for OFAC sanctions",
    "maxBudget": 1,
    "preferences": { "speed": "balanced", "minReputation": 0.8 }
  }' \
  http://127.0.0.1:3000/api/v1/vend
```

Execute the paid request:

```bash
"$HOME/.tempo/bin/tempo" request -t -X POST \
  --json '{
    "query":"Screen Acme Corp for OFAC sanctions",
    "maxBudget": 1,
    "preferences": { "speed": "balanced", "minReputation": 0.8 }
  }' \
  http://127.0.0.1:3000/api/v1/vend
```

## Free endpoints

List providers:

```bash
curl -sS http://127.0.0.1:3000/api/v1/providers
```

Get vend status:

```bash
curl -sS http://127.0.0.1:3000/api/v1/vend/<vend_id>
```

## Notes

- The paid edge is implemented for the Vending Machine API itself. The mock downstream providers are not individually MPP-gated yet.
- The stdio MCP server is local and does not itself perform an MPP payment handshake. It reuses the same core vend engine for local agent integration.
