import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Mppx, tempo } from "mppx/server";
import type { Address } from "viem";
import { createProvider, finalizeVend, getVend, listProviders, prepareVend } from "./engine.js";
import { validateCategory } from "./providers.js";
import type { Provider, VendInput } from "./types.js";
import { createId } from "./utils.js";

const port = Number(process.env.PORT ?? 3000);
const tempoRecipient = process.env.TEMPO_RECIPIENT;
const tempoCurrency = (process.env.TEMPO_CURRENCY ?? "0x20c0000000000000000000000000000000000000") as Address;

const app = new Hono();
const mppx = tempoRecipient
  ? Mppx.create({
      methods: [
        tempo({
          currency: tempoCurrency,
          recipient: tempoRecipient as Address
        })
      ]
    })
  : null;

function validateVendInput(value: unknown): VendInput {
  if (!value || typeof value !== "object") {
    throw new Error("Body must be a JSON object.");
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.query !== "string" || candidate.query.trim().length === 0) {
    throw new Error("query must be a non-empty string.");
  }

  if (typeof candidate.maxBudget !== "number" || !Number.isFinite(candidate.maxBudget) || candidate.maxBudget <= 0) {
    throw new Error("maxBudget must be a positive number.");
  }

  const category = validateCategory(candidate.category);
  const preferences = candidate.preferences;

  return {
    query: candidate.query.trim(),
    category,
    maxBudget: candidate.maxBudget,
    preferences:
      preferences && typeof preferences === "object"
        ? {
            speed:
              (preferences as Record<string, unknown>).speed === "fast" ||
              (preferences as Record<string, unknown>).speed === "balanced" ||
              (preferences as Record<string, unknown>).speed === "cheap"
                ? ((preferences as Record<string, unknown>).speed as "fast" | "balanced" | "cheap")
                : undefined,
            minReputation:
              typeof (preferences as Record<string, unknown>).minReputation === "number"
                ? ((preferences as Record<string, unknown>).minReputation as number)
                : undefined
          }
        : undefined,
    negotiation:
      candidate.negotiation && typeof candidate.negotiation === "object"
        ? {
            batchSize:
              typeof (candidate.negotiation as Record<string, unknown>).batchSize === "number"
                ? ((candidate.negotiation as Record<string, unknown>).batchSize as number)
                : undefined,
            allowPartialFulfillment:
              typeof (candidate.negotiation as Record<string, unknown>).allowPartialFulfillment === "boolean"
                ? ((candidate.negotiation as Record<string, unknown>).allowPartialFulfillment as boolean)
                : undefined,
            allowCounterOffers:
              typeof (candidate.negotiation as Record<string, unknown>).allowCounterOffers === "boolean"
                ? ((candidate.negotiation as Record<string, unknown>).allowCounterOffers as boolean)
                : undefined,
            autoAcceptLowest:
              typeof (candidate.negotiation as Record<string, unknown>).autoAcceptLowest === "boolean"
                ? ((candidate.negotiation as Record<string, unknown>).autoAcceptLowest as boolean)
                : undefined
          }
        : undefined
  };
}

function validateProviderInput(value: unknown): Provider {
  if (!value || typeof value !== "object") {
    throw new Error("Body must be a JSON object.");
  }

  const candidate = value as Record<string, unknown>;
  const category = validateCategory(candidate.category);

  if (!category) {
    throw new Error("category must be one of compliance, b2b_data, ai_inference, general_research.");
  }

  if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
    throw new Error("name must be a non-empty string.");
  }

  if (typeof candidate.endpoint !== "string" || candidate.endpoint.trim().length === 0) {
    throw new Error("endpoint must be a non-empty string.");
  }

  if (typeof candidate.basePrice !== "number" || candidate.basePrice <= 0) {
    throw new Error("basePrice must be a positive number.");
  }

  if (typeof candidate.avgLatencyMs !== "number" || candidate.avgLatencyMs <= 0) {
    throw new Error("avgLatencyMs must be a positive number.");
  }

  if (typeof candidate.reputation !== "number" || candidate.reputation < 0 || candidate.reputation > 1) {
    throw new Error("reputation must be a number between 0 and 1.");
  }

  return {
    id: createId("prov"),
    name: candidate.name.trim(),
    category,
    endpoint: candidate.endpoint.trim(),
    basePrice: candidate.basePrice,
    avgLatencyMs: candidate.avgLatencyMs,
    reputation: candidate.reputation,
    capabilities: Array.isArray(candidate.capabilities)
      ? candidate.capabilities.filter((item): item is string => typeof item === "string")
      : [],
    execute: (query) => ({
      summary: `${candidate.name} returned a custom mock response.`,
      payload: {
        query,
        provider: candidate.name,
        endpoint: candidate.endpoint,
        note: "Custom providers are mock-only in this MVP."
      }
    })
  };
}

app.get("/health", (c) =>
  c.json({
    ok: true,
    mpp: {
      enabled: Boolean(mppx),
      currency: tempoCurrency,
      recipientConfigured: Boolean(tempoRecipient)
    }
  })
);

app.get("/api/v1/providers", (c) => {
  const category = c.req.query("category");
  return c.json({ providers: listProviders(category) });
});

app.post("/api/v1/providers", async (c) => {
  try {
    const provider = createProvider(validateProviderInput(await c.req.json()));
    return c.json({ provider }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return c.json({ error: message }, 400);
  }
});

app.post("/api/v1/vend", async (c) => {
  try {
    if (!mppx) {
      return c.json(
        {
          error: "MPP is not configured. Set TEMPO_RECIPIENT to a Tempo wallet address before starting the server."
        },
        503
      );
    }

    const rawRequest = c.req.raw;
    const payload = validateVendInput(await rawRequest.clone().json());
    const prepared = prepareVend(payload);
    const charge = await mppx.charge({
      amount: prepared.total.toFixed(2),
      description: `Vend query: ${prepared.category}`
    })(rawRequest);

    if (charge.status === 402) {
      return charge.challenge;
    }

    const receiptProbe = charge.withReceipt(new Response(null));
    const paymentReceipt = receiptProbe.headers.get("Payment-Receipt") ?? undefined;
    const record = finalizeVend(prepared, "mpp", paymentReceipt);
    return charge.withReceipt(c.json(record, 200));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return c.json({ error: message }, 400);
  }
});

app.get("/api/v1/vend/:id", (c) => {
  const record = getVend(c.req.param("id"));
  return record ? c.json(record) : c.json({ error: "Not found" }, 404);
});

serve(
  {
    fetch: app.fetch,
    port,
    hostname: "127.0.0.1"
  },
  () => {
    process.stdout.write(`HTTP server listening on http://127.0.0.1:${port}\n`);
  }
);
