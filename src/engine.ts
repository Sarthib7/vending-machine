import { classifyQuery } from "./router.js";
import { store } from "./store.js";
import type {
  PreparedVend,
  PreferenceMode,
  Provider,
  ProviderOffer,
  VendInput,
  VendPreferences,
  VendRecord
} from "./types.js";
import { clamp, createId, nowIso } from "./utils.js";

function normalizePrice(price: number, maxPrice: number): number {
  if (maxPrice <= 0) {
    return 1;
  }

  return 1 - clamp(price / maxPrice, 0, 1);
}

function normalizeLatency(latencyMs: number, maxLatencyMs: number): number {
  if (maxLatencyMs <= 0) {
    return 1;
  }

  return 1 - clamp(latencyMs / maxLatencyMs, 0, 1);
}

function getWeights(mode: PreferenceMode | undefined): { price: number; speed: number; reputation: number } {
  switch (mode) {
    case "fast":
      return { price: 0.2, speed: 0.55, reputation: 0.25 };
    case "cheap":
      return { price: 0.55, speed: 0.2, reputation: 0.25 };
    default:
      return { price: 0.4, speed: 0.3, reputation: 0.3 };
  }
}

function buildOffer(provider: Provider, providers: Provider[], preferences: VendPreferences): ProviderOffer {
  const highestPrice = Math.max(...providers.map((candidate) => candidate.basePrice));
  const highestLatency = Math.max(...providers.map((candidate) => candidate.avgLatencyMs));
  const weights = getWeights(preferences.speed);
  const priceScore = normalizePrice(provider.basePrice, highestPrice);
  const latencyScore = normalizeLatency(provider.avgLatencyMs, highestLatency);
  const reputationScore = clamp(provider.reputation, 0, 1);
  const score = Number(
    (
      priceScore * weights.price +
      latencyScore * weights.speed +
      reputationScore * weights.reputation
    ).toFixed(4)
  );

  return {
    providerId: provider.id,
    providerName: provider.name,
    price: provider.basePrice,
    latencyMs: provider.avgLatencyMs,
    reputation: provider.reputation,
    score,
    rationale: `weighted for ${preferences.speed ?? "balanced"} mode`
  };
}

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
  const matchedProviders = store
    .listProviders()
    .filter((provider) => provider.category === category)
    .filter((provider) => provider.reputation >= minReputation)
    .filter((provider) => provider.basePrice <= input.maxBudget);

  if (matchedProviders.length === 0) {
    throw new Error("No providers matched the category, reputation, and budget constraints.");
  }

  const offers = matchedProviders
    .map((provider) => buildOffer(provider, matchedProviders, preferences))
    .sort((left, right) => right.score - left.score || left.price - right.price);
  const winnerOffer = offers[0];

  if (!winnerOffer) {
    throw new Error("Offer ranking produced no winner.");
  }

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
    offers,
    winner,
    providerCost,
    platformFee,
    total,
    winningReason: `${winner.name} achieved the best weighted score for ${preferences.speed ?? "balanced"} mode.`
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
