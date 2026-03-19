import { classifyQuery } from "./router.js";
import { store } from "./store.js";
import { buildNegotiationRfo, runLocalNegotiationAuction } from "./negotiation-layer.js";
import type {
  PreparedVend,
  Provider,
  VendInput,
  VendRecord
} from "./types.js";
import { createId, nowIso } from "./utils.js";

export function listProviders(category?: string): Provider[] {
  const providers = store.listProviders();
  return category ? providers.filter((provider) => provider.category === category) : providers;
}

export function createProvider(provider: Provider): Provider {
  return store.createProvider(provider);
}

export function getVend(vendId: string): VendRecord | undefined {
  return store.getVend(vendId);
}

export function prepareVend(input: VendInput): PreparedVend {
  const category = classifyQuery(input.query, input.category);
  const preferences = input.preferences ?? {};
  const minReputation = preferences.minReputation ?? 0;
  const negotiationRfo = buildNegotiationRfo(input, category);
  const matchedProviders = store
    .listProviders()
    .filter((provider) => provider.category === category)
    .filter((provider) => provider.reputation >= minReputation)
    .filter((provider) => provider.basePrice <= input.maxBudget);

  if (matchedProviders.length === 0) {
    throw new Error("No providers matched the category, reputation, and budget constraints.");
  }

  const negotiation = runLocalNegotiationAuction(negotiationRfo, matchedProviders, preferences);
  const winnerOffer = negotiation.winnerOffer;

  const winner = store.getProvider(winnerOffer.providerId);

  if (!winner) {
    throw new Error("Offer ranking selected a missing provider.");
  }

  const platformFee = Number(Math.max(0.05, winnerOffer.price * 0.15).toFixed(2));
  const providerCost = Number(winnerOffer.price.toFixed(2));
  const total = Number((providerCost + platformFee).toFixed(2));

  return {
    input,
    category,
    offers: negotiation.offers,
    winner,
    providerCost,
    platformFee,
    total,
    winningReason: negotiation.winningReason
  };
}

export function finalizeVend(prepared: PreparedVend, settlementMode: "mpp" | "local", receipt?: string): VendRecord {
  const startedAt = Date.now();
  const record: VendRecord = {
    id: createId("vend"),
    query: prepared.input.query,
    category: prepared.category,
    maxBudget: prepared.input.maxBudget,
    status: "completed",
    result: prepared.winner.execute(prepared.input.query),
    cost: {
      providerCost: prepared.providerCost,
      platformFee: prepared.platformFee,
      total: prepared.total
    },
    provider: {
      id: prepared.winner.id,
      name: prepared.winner.name,
      reputation: prepared.winner.reputation,
      latencyMs: prepared.winner.avgLatencyMs
    },
    negotiation: {
      providersQueried: prepared.offers.length,
      offersReceived: prepared.offers.length,
      winningReason: prepared.winningReason,
      offers: prepared.offers
    },
    settlements: [
      {
        id: createId("set"),
        direction: "user_to_vm",
        amount: prepared.total,
        status: "completed",
        receipt,
        mode: settlementMode,
        createdAt: nowIso()
      }
    ],
    latencyMs: Date.now() - startedAt,
    createdAt: nowIso(),
    completedAt: nowIso()
  };

  store.saveVend(record);
  return record;
}

export function vend(input: VendInput): VendRecord {
  const prepared = prepareVend(input);
  return finalizeVend(prepared, "local");
}
