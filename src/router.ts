import type { Category } from "./types.js";

const keywordMap: Array<{ category: Category; keywords: string[] }> = [
  { category: "compliance", keywords: ["sanction", "ofac", "pep", "kyc", "aml", "compliance"] },
  { category: "b2b_data", keywords: ["revenue", "firmographic", "company", "employee", "funding"] },
  { category: "ai_inference", keywords: ["summarize", "classify", "extract", "rewrite", "model"] }
];

export function classifyQuery(query: string, explicitCategory?: Category): Category {
  if (explicitCategory) {
    return explicitCategory;
  }

  const normalized = query.toLowerCase();

  for (const candidate of keywordMap) {
    if (candidate.keywords.some((keyword) => normalized.includes(keyword))) {
      return candidate.category;
    }
  }

  return "general_research";
}
