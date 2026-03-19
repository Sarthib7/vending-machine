#!/usr/bin/env node

import { renderProviders, renderVendSummary, animateDemo } from "./ascii.js";
import { listProviders, vend } from "./engine.js";
import { validateCategory } from "./providers.js";
import type { Category, PreferenceMode, VendInput } from "./types.js";
import { asJson } from "./utils.js";

type FlagMap = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; flags: FlagMap } {
  const [command = "help", ...rest] = argv;
  const flags: FlagMap = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    i += 1;
  }

  return { command, flags };
}

function readString(flags: FlagMap, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(flags: FlagMap, key: string): number | undefined {
  const value = readString(flags, key);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${key} must be a number.`);
  }
  return parsed;
}

function readBoolean(flags: FlagMap, key: string): boolean | undefined {
  const value = flags[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function readCategory(flags: FlagMap): Category | undefined {
  return validateCategory(readString(flags, "category"));
}

function readSpeed(flags: FlagMap): PreferenceMode | undefined {
  const value = readString(flags, "speed");
  return value === "fast" || value === "balanced" || value === "cheap" ? value : undefined;
}

function help(): void {
  process.stdout.write(`
vending-machine

Usage:
  vending-machine demo [--loops 2] [--delay 520]
  vending-machine providers [--category compliance] [--json]
  vending-machine vend --query "Screen Acme Corp for OFAC sanctions" --budget 1 [--speed balanced] [--min-reputation 0.8] [--batch-size 1] [--json]

Examples:
  vending-machine demo
  vending-machine providers --category compliance
  vending-machine vend --query "Screen Acme Corp for OFAC sanctions" --budget 1 --speed balanced
`);
}

async function run(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const json = Boolean(flags.json);

  switch (command) {
    case "demo":
      await animateDemo(readNumber(flags, "loops") ?? 2, readNumber(flags, "delay") ?? 520);
      return;
    case "providers": {
      const providers = listProviders(readCategory(flags));
      process.stdout.write(json ? `${asJson({ providers })}\n` : `${renderProviders(providers)}\n`);
      return;
    }
    case "vend":
    case "try":
    case "tryout": {
      const query = readString(flags, "query");
      const budget = readNumber(flags, "budget");

      if (!query || typeof budget !== "number") {
        throw new Error("vend requires --query and --budget.");
      }

      const input: VendInput = {
        query,
        category: readCategory(flags),
        maxBudget: budget,
        preferences: {
          speed: readSpeed(flags),
          minReputation: readNumber(flags, "min-reputation")
        },
        negotiation: {
          batchSize: readNumber(flags, "batch-size"),
          allowPartialFulfillment: readBoolean(flags, "allow-partial"),
          allowCounterOffers: readBoolean(flags, "allow-counter-offers"),
          autoAcceptLowest: readBoolean(flags, "auto-accept")
        }
      };

      const result = vend(input);
      process.stdout.write(json ? `${asJson(result)}\n` : `${renderVendSummary(result)}\n`);
      return;
    }
    case "help":
    default:
      help();
  }
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
