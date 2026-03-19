import { clamp } from "./utils.js";
import type {
  Category,
  NegotiationOptions,
  PreferenceMode,
  Provider,
  ProviderOffer,
  VendInput,
  VendPreferences
} from "./types.js";

export interface NegotiationRfo {
  category: Category;
  title: string;
  description: string;
  maxPriceUsd: number;
  batchSize: number;
  allowPartialFulfillment: boolean;
  allowCounterOffers: boolean;
  autoAcceptLowest: boolean;
  minProviderReputation: number;
}

export interface NegotiationResult {
  rfo: NegotiationRfo;
  offers: ProviderOffer[];
  winnerOffer: ProviderOffer;
  winningReason: string;
}

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

export function buildNegotiationRfo(input: VendInput, category: Category): NegotiationRfo {
  const negotiation = input.negotiation ?? {};
  const preferences = input.preferences ?? {};

  return {
    category,
    title: `Vend query for ${category}`,
    description: input.query,
    maxPriceUsd: input.maxBudget,
    batchSize: negotiation.batchSize ?? 1,
    allowPartialFulfillment: negotiation.allowPartialFulfillment ?? false,
    allowCounterOffers: negotiation.allowCounterOffers ?? true,
    autoAcceptLowest: negotiation.autoAcceptLowest ?? true,
    minProviderReputation: preferences.minReputation ?? 0
  };
}

export function runLocalNegotiationAuction(
  rfo: NegotiationRfo,
  providers: Provider[],
  preferences: VendPreferences
): NegotiationResult {
  const offers = providers
    .map((provider) => buildOffer(provider, providers, preferences))
    .sort((left, right) => right.score - left.score || left.price - right.price);
  const winnerOffer = offers[0];

  if (!winnerOffer) {
    throw new Error("Offer ranking produced no winner.");
  }

  const winningReason = rfo.autoAcceptLowest
    ? `${winnerOffer.providerName} won the reverse auction with the best weighted score under the current constraints.`
    : `${winnerOffer.providerName} is the current best-ranked offer awaiting manual acceptance.`;

  return {
    rfo,
    offers,
    winnerOffer,
    winningReason
  };
}
