# The Vending Machine — Hackathon Build Plan

**Project**: The Vending Machine  
**Hackathon**: Tempo × Stripe HIIT Hackathon (March 19, 2026)  
**Builder**: Kairen team  
**Stack**: Tempo L1 + MPP + Kairen x402n negotiation engine  

---

## 1. What is the vending machine?

A procurement engine for machine-payable services. Users (humans or AI agents) submit queries with a budget. The Vending Machine fans the query out to competing providers, negotiates the best deal via Kairen's x402n layer, settles payment via MPP on Tempo, and returns the result. The user never sees a wallet, a token, or a blockchain — they just get better data at lower prices.

**One-liner pitch:** "You put a question in, you get an answer out. The machine finds the cheapest, fastest, most reliable provider for you — and handles payment automatically."

### Why it's NOT just another directory

| MPP Directory (mpp.dev) | The Vending Machine |
|---|---|
| Flat price list — take it or leave it | Competitive bidding — providers race to win |
| One provider per query | Multiple providers compete per query |
| Manual selection — you pick who to pay | Auto-selection — best deal wins by score |
| Fixed pricing only | Dynamic pricing via RFO negotiation |
| No quality comparison | Ranked by price × speed × reputation |
| User manages multiple API calls | Single query, machine handles orchestration |

**The directory is a phone book. The Vending Machine is a procurement department.**

---

## 2. Architecture — four layers

### Layer 1: Request interface (how queries get in)

Four entry points, all hitting the same backend:

- **REST API** — `POST /api/v1/vend` with JSON payload (query, category, max budget, preferences)
- **Web UI** — Simple form for human users (hackathon demo)
- **MCP tool server** — AI agents discover the Vending Machine as an MCP tool and call it natively
- **SDK** — `npm install @kairen/vend` with `vend("screen this company for sanctions", { budget: 2.00 })`

### Layer 2: Query router (classification + fan-out)

Takes the raw query and:

1. **Classifies** it into a service category (compliance, B2B data, sensor data, AI inference, etc.)
2. **Matches** providers from the registry that serve this category
3. **Constructs** an RFO (Request for Offer) with structured requirements
4. **Broadcasts** the RFO to matched providers via x402n

For the hackathon demo, classification can be rule-based (keyword matching on category tags). Post-hackathon, use LLM-based intent classification.

### Layer 3: Negotiation engine (x402n — already built)

This is Kairen's existing x402n layer, adapted for the Vending Machine flow:

1. **RFO broadcast** — `POST /api/v1/rfos` creates the demand
2. **Provider offers** — Providers respond via `POST /api/v1/rfos/{id}/offers` with price, delivery time, SLA
3. **Offer ranking** — `GET /api/v1/rfos/{id}/offers/ranked` scores by price × speed × reputation
4. **Auto-accept** — Best offer automatically wins (configurable: can require human approval)
5. **Deal creation** — Accepted offer becomes a deal with escrow-backed settlement

Key adaptation for the hackathon: the RFO → offer → accept cycle needs to happen in under 500ms. For the demo, providers are pre-registered and respond via webhooks or polling. The ranking engine runs the scoring function and auto-accepts.

### Layer 4: MPP settlement (payment + delivery)

Once a deal is created:

1. **Open MPP session** with winning provider (or use charge for one-shot)
2. **Pay via HTTP 402** — the Vending Machine acts as the MPP client, pays the provider's endpoint
3. **Receive data** from provider's HTTP response
4. **Validate** the response (schema check, completeness)
5. **Return** result to user with payment receipt
6. **Charge user** the provider cost + platform fee via their pre-funded MPP session

Settlement flow on Tempo:
```
User → [MPP Session $2.00 deposit] → Vending Machine
Vending Machine → [MPP Charge $0.30] → Winning Provider
Vending Machine → [Refund $1.65] → User (unspent deposit)
Platform keeps: $0.05 fee
```

---

## 3. Technical architecture

### Backend (new service)

```
Language:      TypeScript (fastest iteration for hackathon)
Framework:     Hono (lightweight, MPP middleware ready)
MPP SDK:       mppx (server + client)
Database:      SQLite (hackathon) → PostgreSQL (production)
Deployment:    Railway or Cloudflare Workers
```

### Kairen integration (existing)

```
x402n backend: Rust/Axum (already running)
x402n API:     POST /rfos, POST /rfos/:id/offers, GET /rfos/:id/offers/ranked
Payment:       Circle USDC (existing) + MPP on Tempo (new for hackathon)
Database:      PostgreSQL (existing — agents, rfos, offers, deals, payments)
```

### New components to build

| Component | What it does | Effort |
|---|---|---|
| `vend-api` | Hono server with /vend endpoint, query router, result aggregator | ~3 hours |
| `mpp-bridge` | Connects x402n deals to MPP session/charge settlement on Tempo | ~2 hours |
| `provider-adapter` | Wraps MPP directory services as x402n providers | ~2 hours |
| `demo-ui` | Simple web form for submitting queries and seeing results | ~1 hour |
| `demo-providers` | 2-3 mock providers (compliance, B2B data) with different prices | ~1 hour |

**Total estimated build time: ~9 hours (fits 3 hackathon rounds)**

---

## 4. Data model

### New tables (vend-api)

```sql
-- Vend requests (user-facing queries)
CREATE TABLE vend_requests (
  id            TEXT PRIMARY KEY,
  query         TEXT NOT NULL,
  category      TEXT NOT NULL,
  max_budget    DECIMAL(10,4) NOT NULL,
  status        TEXT DEFAULT 'pending',  -- pending, routing, negotiating, settling, completed, failed
  rfo_id        TEXT,                     -- links to x402n RFO
  deal_id       TEXT,                     -- links to x402n deal
  result        JSONB,                    -- final response data
  cost          DECIMAL(10,4),            -- actual cost paid
  platform_fee  DECIMAL(10,4),            -- our cut
  latency_ms    INTEGER,                  -- total request time
  created_at    TIMESTAMP DEFAULT NOW(),
  completed_at  TIMESTAMP
);

-- Provider registry (maps MPP services to x402n agents)
CREATE TABLE providers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  mpp_endpoint  TEXT NOT NULL,             -- the HTTP 402 endpoint
  x402n_agent   TEXT NOT NULL,             -- agent ID in x402n
  base_price    DECIMAL(10,4),
  avg_latency   INTEGER,
  reputation    DECIMAL(3,2) DEFAULT 1.0,
  active        BOOLEAN DEFAULT TRUE
);

-- Settlement records (MPP transactions)
CREATE TABLE settlements (
  id            TEXT PRIMARY KEY,
  vend_id       TEXT REFERENCES vend_requests(id),
  direction     TEXT NOT NULL,             -- user_to_vm, vm_to_provider, refund
  amount        DECIMAL(10,4) NOT NULL,
  mpp_receipt   TEXT,                      -- MPP payment receipt hash
  tempo_tx      TEXT,                      -- Tempo transaction hash
  status        TEXT DEFAULT 'pending',
  created_at    TIMESTAMP DEFAULT NOW()
);
```

### Existing x402n tables (no changes needed)

- `agents` — provider/consumer registrations
- `rfos` — request for offers
- `offers` — provider bids
- `deals` — accepted offers with escrow
- `payment_transactions` — Circle USDC ledger

---

## 5. API design

### Primary endpoint

```
POST /api/v1/vend
Authorization: Payment <mpp-credential>

{
  "query": "Screen Acme Corp for OFAC sanctions",
  "category": "compliance",        // optional, auto-detected if omitted
  "max_budget": 2.00,
  "preferences": {
    "speed": "fast",               // fast | balanced | cheap
    "min_reputation": 0.8
  }
}
```

Response:
```
200 OK
Payment-Receipt: <mpp-receipt>

{
  "id": "vend_abc123",
  "status": "completed",
  "result": {
    "entity": "Acme Corp",
    "sanctions_match": false,
    "confidence": 0.97,
    "sources_checked": ["OFAC", "EU", "UN"],
    "checked_at": "2026-03-19T14:30:00Z"
  },
  "cost": {
    "provider_cost": 0.30,
    "platform_fee": 0.05,
    "total": 0.35
  },
  "provider": {
    "name": "ComplianceCheck.io",
    "reputation": 0.95,
    "latency_ms": 340
  },
  "negotiation": {
    "providers_queried": 3,
    "offers_received": 3,
    "winning_reason": "Best price-speed ratio"
  }
}
```

### Status endpoint (for async queries)

```
GET /api/v1/vend/{id}
→ Returns current status + result when complete
```

### Provider registration

```
POST /api/v1/providers
{
  "name": "ComplianceCheck.io",
  "category": "compliance",
  "mpp_endpoint": "https://api.compliancecheck.io/screen",
  "base_price": 0.30,
  "capabilities": ["OFAC", "EU_sanctions", "PEP"]
}
```

---

## 6. The MPP bridge — connecting x402n to Tempo

This is the key new component. It translates between Kairen's existing Circle/USDC settlement and MPP's HTTP 402 flow on Tempo.

### Flow

```
1. User pays Vending Machine via MPP (user → VM)
   - MPP session: user locks deposit on Tempo
   - VM receives Authorization: Payment header

2. VM creates RFO in x402n → providers bid → best offer wins

3. VM pays winning provider via MPP (VM → provider)
   - VM calls provider's HTTP 402 endpoint
   - Pays via MPP charge on Tempo
   - Gets data back in HTTP response

4. VM returns data to user
   - Refunds unspent deposit from user's MPP session
   - Keeps platform fee
```

### Code sketch (Hono + mppx)

```typescript
import { Hono } from 'hono'
import { Mppx } from 'mppx/server'
import { mppClient } from 'mppx'

const app = new Hono()

// Accept MPP payments from users
const mpp = Mppx.create({
  methods: [tempo({ currency: PATHUSD, recipient: VM_WALLET })],
})

app.post('/api/v1/vend', mpp.protect({ amount: 'dynamic' }), async (c) => {
  const { query, category, max_budget } = await c.req.json()

  // 1. Classify query
  const matched = await classifyAndMatch(query, category)

  // 2. Create RFO in x402n
  const rfo = await x402n.createRFO({
    title: query,
    max_price_usdc: max_budget,
    deadline_hours: 0.001, // ~3.6 seconds for hackathon
    requirements: matched.requirements,
  })

  // 3. Wait for offers (providers respond via webhook or polling)
  const offers = await x402n.waitForOffers(rfo.id, { timeout: 2000 })

  // 4. Auto-accept best offer
  const ranked = await x402n.getRankedOffers(rfo.id)
  const best = ranked[0]
  const deal = await x402n.acceptOffer(best.id)

  // 5. Pay provider via MPP and get result
  const result = await mppClient.fetch(best.mpp_endpoint, {
    method: 'POST',
    body: JSON.stringify({ query }),
    payment: { maxAmount: best.proposed_price_usdc },
  })

  // 6. Return to user
  return c.json({
    status: 'completed',
    result: await result.json(),
    cost: {
      provider_cost: best.proposed_price_usdc,
      platform_fee: 0.05,
      total: best.proposed_price_usdc + 0.05,
    },
    negotiation: {
      providers_queried: matched.providers.length,
      offers_received: offers.length,
      winning_reason: ranked[0].ranking_reason,
    },
  })
})
```

---

## 7. Hackathon build schedule (3 rounds)

### Round 1 — Core flow (3 hours)

**Goal: Query in → negotiation → result out (with mock providers)**

- [ ] Set up Hono server with `/api/v1/vend` endpoint
- [ ] Build query router (rule-based category matching)
- [ ] Connect to x402n API for RFO creation + offer ranking
- [ ] Create 3 mock providers that respond to RFOs with different prices/speeds
- [ ] Wire up auto-accept on best ranked offer
- [ ] Return mock data as result
- [ ] **Demo: Submit a query, show 3 providers competing, best one wins**

### Round 2 — Real MPP settlement (3 hours)

**Goal: Actual payments flowing on Tempo via MPP**

- [ ] Integrate `mppx` server middleware to accept payments from users
- [ ] Integrate `mppx` client to pay winning provider's MPP endpoint
- [ ] Set up Tempo wallet for the Vending Machine
- [ ] Build the MPP bridge (user payment → provider payment → refund)
- [ ] Add payment receipt to response
- [ ] **Demo: Real money (testnet stablecoins) flowing through the system**

### Round 3 — Polish + UI + wow factor (3 hours)

**Goal: Beautiful demo that tells the story**

- [ ] Build web UI showing the full flow visually (query → providers bidding → winner → result)
- [ ] Real-time dashboard showing negotiation happening live
- [ ] Add 1-2 real MPP directory services as providers (if available)
- [ ] Add session support for repeat queries (deposit once, query many times)
- [ ] Polish API responses with full cost breakdown and negotiation metadata
- [ ] **Demo: Live walkthrough showing invisible blockchain, visible value**

---

## 8. Demo script (for judges)

### The pitch (30 seconds)

"Every service in the MPP directory has a fixed price. That means you're always paying list price. The Vending Machine changes that. You submit a query, we broadcast it to every provider that can serve it, they compete on price and speed, and the best deal wins automatically. Think of it as the procurement engine that sits on top of MPP. You get better prices, faster results, and you never see a blockchain."

### The demo (2 minutes)

1. **Show the web UI** — clean, simple, no crypto jargon anywhere
2. **Submit a query**: "Screen Acme Corp for OFAC sanctions" with $2.00 budget
3. **Show the negotiation live**: 3 providers appear, their offers come in real-time
   - Provider A: $0.45, 200ms
   - Provider B: $0.30, 500ms
   - Provider C: $0.60, 100ms
4. **Show the ranking**: "Provider B wins — best price-to-speed ratio at $0.30"
5. **Show the result**: Clean sanctions report, $0.35 total (including $0.05 platform fee)
6. **Show the receipt**: MPP payment settled on Tempo in 0.6 seconds
7. **The kicker**: "The user paid $0.35 for a sanctions check. No account. No subscription. No blockchain visible. Under the hood: MPP session on Tempo, competitive bidding via x402n, stablecoin settlement in under a second."

### Key talking points for Q&A

- "Why not just use the MPP directory?" → "The directory is a price list. We're a procurement engine. Fixed prices vs. competitive bidding."
- "How is this defensible?" → "Network effects on both sides. More providers = better prices for users. More users = more volume for providers. Plus the negotiation logic and ranking algorithms compound with data."
- "What verticals?" → "We start with compliance and B2B data for the demo. But the engine is vertical-agnostic — compliance, sensor data, AI inference, any service with multiple providers."
- "How does Kairen connect?" → "x402n is our existing negotiation layer. The Vending Machine is the consumer-facing product built on top of it. The engine is Kairen's x402n, the interface is the Vending Machine."

---

## 9. Long-term vision (post-hackathon)

### Phase 1: Vertical expansion (weeks 1-4)

- Add compliance providers (OFAC, PEP, AML screening)
- Add B2B data providers (firmographic, intent, contact data)
- Add sensor/IoT data marketplace (industrial, agricultural, environmental)
- Each vertical is a "shelf" in the vending machine

### Phase 2: Advanced negotiation (months 2-3)

- **Batched queries**: "Screen these 100 companies" → bulk RFO with volume discount negotiation
- **Auction mode**: Reverse auction where providers bid down in real-time
- **SLA-based routing**: Route to different providers based on latency/accuracy requirements
- **Multi-provider aggregation**: Query 3 providers, merge results, pay all via MPP sessions

### Phase 3: Full Kairen integration (months 4-6)

- **ForgeID reputation**: Provider reputation scores flow from on-chain behavior
- **AgentNet routing**: Premium network routing for high-value queries
- **Cross-protocol settlement**: MPP + x402 + Stripe simultaneously (kairen-pay SDK)
- **MCP marketplace**: Every Vending Machine endpoint is also a discoverable MCP tool

### The endgame

The Vending Machine becomes the default way agents and businesses buy data and services. Not a marketplace you browse — a machine you query. One input, best output, invisible infrastructure. Every industry vertical is a shelf. Every provider competes. Every payment settles in under a second.

---

## 10. File structure (hackathon repo)

```
vending-machine/
├── README.md
├── package.json
├── src/
│   ├── index.ts              # Hono server entry point
│   ├── routes/
│   │   ├── vend.ts           # POST /api/v1/vend
│   │   ├── providers.ts      # Provider registration
│   │   └── status.ts         # GET /api/v1/vend/:id
│   ├── engine/
│   │   ├── router.ts         # Query classification + provider matching
│   │   ├── negotiator.ts     # x402n RFO/offer/deal orchestration
│   │   └── settler.ts        # MPP payment bridge
│   ├── providers/
│   │   ├── mock-compliance.ts    # Mock sanctions screening provider
│   │   ├── mock-b2b-data.ts      # Mock business data provider
│   │   └── mock-sensor.ts        # Mock sensor data provider
│   ├── db/
│   │   ├── schema.sql
│   │   └── queries.ts
│   └── config.ts
├── ui/
│   ├── index.html            # Demo web interface
│   └── app.js                # Frontend logic
├── docker-compose.yml
└── .env.example
```
