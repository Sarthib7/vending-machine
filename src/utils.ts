import { randomUUID } from "node:crypto";
import type { Address } from "viem";

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function asJson<T>(value: T): string {
  return JSON.stringify(value, null, 2);
}

export function normalizeTempoAddress(value: string | undefined): Address | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const normalized = trimmed.startsWith("tempox0x") ? trimmed.slice("tempox".length) : trimmed;

  if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error(`Invalid Tempo address: ${value}`);
  }

  return normalized as Address;
}
