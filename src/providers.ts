import type { Category, Provider, ProviderResult } from "./types.js";

function buildComplianceResult(query: string, provider: string, confidence: number): ProviderResult {
  const entity = query.replace(/^screen\s+/i, "").replace(/\s+for.*$/i, "").trim() || "Unknown entity";

  return {
    summary: `${provider} completed a sanctions screen for ${entity}.`,
    payload: {
      entity,
      sanctionsMatch: false,
      confidence,
      checkedSources: ["OFAC", "EU", "UN"],
      checkedAt: new Date().toISOString()
    }
  };
}

function buildB2BResult(query: string, provider: string): ProviderResult {
  return {
    summary: `${provider} returned a compact company intelligence profile.`,
    payload: {
      query,
      company: "Acme Corp",
      employeeRange: "201-500",
      estimatedRevenueUsd: 24000000,
      headquarters: "Berlin, Germany",
      freshness: "mock-live"
    }
  };
}

function buildAiResult(query: string, provider: string): ProviderResult {
  return {
    summary: `${provider} produced a structured inference response.`,
    payload: {
      task: query,
      output: "This is a minimal demo inference result.",
      modelClass: "mock-small-fast",
      tokensEstimated: 215
    }
  };
}

export function createSeedProviders(): Provider[] {
  return [
    {
      id: "prov_compliance_fast",
      name: "ComplianceCheck Express",
      category: "compliance",
      endpoint: "mock://compliance/express",
      basePrice: 0.42,
      avgLatencyMs: 180,
      reputation: 0.88,
      capabilities: ["OFAC", "EU_sanctions", "UN_sanctions"],
      execute: (query) => buildComplianceResult(query, "ComplianceCheck Express", 0.93)
    },
    {
      id: "prov_compliance_trusted",
      name: "Sanctions Signal Pro",
      category: "compliance",
      endpoint: "mock://compliance/trusted",
      basePrice: 0.57,
      avgLatencyMs: 240,
      reputation: 0.97,
      capabilities: ["OFAC", "EU_sanctions", "UN_sanctions", "PEP"],
      execute: (query) => buildComplianceResult(query, "Sanctions Signal Pro", 0.98)
    },
    {
      id: "prov_b2b_cheap",
      name: "DataCrate Lite",
      category: "b2b_data",
      endpoint: "mock://b2b/lite",
      basePrice: 0.21,
      avgLatencyMs: 320,
      reputation: 0.83,
      capabilities: ["firmographics", "revenue", "employee_count"],
      execute: (query) => buildB2BResult(query, "DataCrate Lite")
    },
    {
      id: "prov_b2b_premium",
      name: "FirmoGraph Prime",
      category: "b2b_data",
      endpoint: "mock://b2b/prime",
      basePrice: 0.39,
      avgLatencyMs: 190,
      reputation: 0.94,
      capabilities: ["firmographics", "revenue", "employee_count", "technographics"],
      execute: (query) => buildB2BResult(query, "FirmoGraph Prime")
    },
    {
      id: "prov_ai_fast",
      name: "Inference Sprint",
      category: "ai_inference",
      endpoint: "mock://ai/sprint",
      basePrice: 0.11,
      avgLatencyMs: 110,
      reputation: 0.87,
      capabilities: ["summarization", "classification", "extraction"],
      execute: (query) => buildAiResult(query, "Inference Sprint")
    },
    {
      id: "prov_general",
      name: "General Research Mesh",
      category: "general_research",
      endpoint: "mock://general/research",
      basePrice: 0.19,
      avgLatencyMs: 260,
      reputation: 0.85,
      capabilities: ["research", "triage"],
      execute: (query) => ({
        summary: "General Research Mesh returned a scoped research answer.",
        payload: {
          query,
          answer: "This is a minimal mock research result.",
          notes: ["No live web calls are made in this MVP."]
        }
      })
    }
  ];
}

export function validateCategory(value: unknown): Category | undefined {
  if (value === "compliance" || value === "b2b_data" || value === "ai_inference" || value === "general_research") {
    return value;
  }

  return undefined;
}
