export type Category = "compliance" | "b2b_data" | "ai_inference" | "general_research";
export type PreferenceMode = "fast" | "balanced" | "cheap";
export type VendStatus = "pending" | "routing" | "negotiating" | "settling" | "completed" | "failed";

export interface VendPreferences {
  speed?: PreferenceMode;
  minReputation?: number;
}

export interface NegotiationOptions {
  batchSize?: number;
  allowPartialFulfillment?: boolean;
  allowCounterOffers?: boolean;
  autoAcceptLowest?: boolean;
}

export interface VendInput {
  query: string;
  category?: Category;
  maxBudget: number;
  preferences?: VendPreferences;
  negotiation?: NegotiationOptions;
}

export interface ProviderOffer {
  providerId: string;
  providerName: string;
  price: number;
  latencyMs: number;
  reputation: number;
  score: number;
  rationale: string;
}

export interface ProviderResult {
  summary: string;
  payload: Record<string, unknown>;
}

export interface Provider {
  id: string;
  name: string;
  category: Category;
  endpoint: string;
  basePrice: number;
  avgLatencyMs: number;
  reputation: number;
  capabilities: string[];
  execute: (query: string) => ProviderResult;
}

export interface SettlementRecord {
  id: string;
  direction: "user_to_vm";
  amount: number;
  status: "completed";
  receipt?: string;
  mode: "mpp" | "local";
  createdAt: string;
}

export interface VendRecord {
  id: string;
  query: string;
  category: Category;
  maxBudget: number;
  status: VendStatus;
  result?: ProviderResult;
  cost?: {
    providerCost: number;
    platformFee: number;
    total: number;
  };
  provider?: {
    id: string;
    name: string;
    reputation: number;
    latencyMs: number;
  };
  negotiation?: {
    providersQueried: number;
    offersReceived: number;
    winningReason: string;
    offers: ProviderOffer[];
  };
  settlements: SettlementRecord[];
  latencyMs?: number;
  createdAt: string;
  completedAt?: string;
}

export interface PreparedVend {
  input: VendInput;
  category: Category;
  offers: ProviderOffer[];
  winner: Provider;
  providerCost: number;
  platformFee: number;
  total: number;
  winningReason: string;
}

export interface ToolCallArgs {
  [key: string]: unknown;
}
