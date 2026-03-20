# The Vending Machine

The Vending Machine is a backend project for procuring machine-payable services through a single interface.

A client submits a query and a budget. The system classifies the request, simulates provider competition, ranks offers by price, speed, and reputation, selects a winner, and returns a structured result. The HTTP API can also gate the vend flow through MPP on Tempo.

This repository is the round-one cut of that project: a backend-only MVP with a CLI, HTTP API, local MCP server, and minimal onchain receipt contract.

Detailed diagrams, architecture notes, and flow documentation live in [docs/architecture.md](/Users/sarthiborkar/Build/vending-machine/docs/architecture.md).

## Round-One Scope

This repository is intentionally narrow for the first submission:

- local procurement engine with seeded mock providers
- CLI for demos and contract payload generation
- HTTP API with an MPP-gated vend route
- local MCP server over stdio
- minimal onchain receipt contract

Deferred for round two:

- real provider integrations
- live x402n network calls
- frontend work
- persistent storage and production settlement flows

## Repository Layout

```text
src/
  ascii.ts              terminal demo renderer
  cli.ts                package CLI
  engine.ts             vend orchestration
  http-server.ts        Hono API + MPP handling
  index.ts              package exports
  mcp-server.ts         local MCP server
  negotiation-layer.ts  mock auction and offer ranking
  providers.ts          seeded providers
  router.ts             query classification
  store.ts              in-memory state
  types.ts              shared types
  utils.ts              helpers

contracts/
  VendingMachineLedger.sol

script/tempo/
  authorize_access_key.sh
  check_tempo_balances.sh
  create_access_key.sh
  deploy_tempo.sh
  fund_tempo.sh
  libtempo.sh

docs/
  architecture.md
```

## Quickstart

Requirements:

- Node.js 22+
- npm
- Foundry only if you want to compile or deploy the contract

Install and verify:

```bash
npm install
npm run check
npm run build
```

Try the MVP locally:

```bash
npm run demo:ascii
npm run providers:demo
npm run vend:demo
npm run contract:payload:demo
```

## Commands

Development:

```bash
npm run cli -- help
npm run dev:http
npm run dev:mcp
```

Built entrypoints:

```bash
npm run start:http
npm run start:mcp
npm run start:cli -- help
```

Tempo helpers:

```bash
npm run tempo:wallet
npm run tempo:access-key:new
npm run tempo:access-key:authorize
npm run tempo:fund
npm run tempo:balances
npm run deploy:tempo
```

## Environment

Copy `.env.example` to `.env` if you want to run the paid HTTP path or Tempo helper scripts.

Minimum useful variable for the API:

```bash
TEMPO_RECIPIENT=0xYourTempoAddress
```

Without `TEMPO_RECIPIENT`, the local CLI and MCP flows still work, but `POST /api/v1/vend` returns `503` because MPP is not configured.

## API

Start the HTTP server:

```bash
npm run dev:http
```

Routes:

- `GET /health`
- `GET /api/v1/providers`
- `POST /api/v1/providers`
- `POST /api/v1/vend`
- `GET /api/v1/vend/:id`

Example request body:

```json
{
  "query": "Screen Acme Corp for OFAC sanctions",
  "maxBudget": 1,
  "preferences": {
    "speed": "balanced",
    "minReputation": 0.8
  }
}
```

## MCP

Run the local MCP server with:

```bash
npm run dev:mcp
```

Tools exposed:

- `vend_query`
- `get_vend_status`
- `list_providers`

## Contract

The contract in [contracts/VendingMachineLedger.sol](/Users/sarthiborkar/Build/vending-machine/contracts/VendingMachineLedger.sol) stores an onchain receipt for completed vends:

- requester
- query hash
- result hash
- total price in micro-USD
- category
- provider
- timestamp

Build it with:

```bash
npm run contracts:build
```

## Submission Notes

The root has been reduced to the runnable MVP. Planning notes, research dumps, and transient status files are excluded so the submission stays focused on round one.
