import { stdin, stdout } from "node:process";
import { getVend, listProviders, vend } from "./engine.js";
import { validateCategory } from "./providers.js";
import type { ToolCallArgs } from "./types.js";

type JsonRpcId = number | string | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

const protocolVersion = "2025-11-25";

const tools: ToolDefinition[] = [
  {
    name: "vend_query",
    title: "Vend Query",
    description: "Route a query to mock providers, rank offers, and return the winning result.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "The user request to procure." },
        category: {
          type: "string",
          enum: ["compliance", "b2b_data", "ai_inference", "general_research"]
        },
        maxBudget: { type: "number", exclusiveMinimum: 0 },
        preferences: {
          type: "object",
          additionalProperties: false,
          properties: {
            speed: { type: "string", enum: ["fast", "balanced", "cheap"] },
            minReputation: { type: "number", minimum: 0, maximum: 1 }
          }
        }
      },
      required: ["query", "maxBudget"]
    }
  },
  {
    name: "get_vend_status",
    title: "Get Vend Status",
    description: "Fetch a prior vend request by ID.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      properties: {
        vendId: { type: "string" }
      },
      required: ["vendId"]
    }
  },
  {
    name: "list_providers",
    title: "List Providers",
    description: "List available mock providers, optionally filtered by category.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      properties: {
        category: {
          type: "string",
          enum: ["compliance", "b2b_data", "ai_inference", "general_research"]
        }
      }
    }
  }
];

let initialized = false;
let buffer = "";

function sendMessage(message: unknown): void {
  const json = JSON.stringify(message);
  stdout.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`);
}

function sendResult(id: JsonRpcId, result: unknown): void {
  sendMessage({ jsonrpc: "2.0", id, result });
}

function sendError(id: JsonRpcId, code: number, message: string): void {
  sendMessage({ jsonrpc: "2.0", id, error: { code, message } });
}

function textResult(payload: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: payload
  };
}

function requireString(args: ToolCallArgs, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }
  return value.trim();
}

function requireNumber(args: ToolCallArgs, key: string): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive number.`);
  }
  return value;
}

function handleToolCall(name: string, args: ToolCallArgs | undefined): unknown {
  const safeArgs = args ?? {};

  switch (name) {
    case "vend_query": {
      const query = requireString(safeArgs, "query");
      const maxBudget = requireNumber(safeArgs, "maxBudget");
      const category = validateCategory(safeArgs.category);
      const preferences =
        safeArgs.preferences && typeof safeArgs.preferences === "object"
          ? {
              speed:
                (safeArgs.preferences as Record<string, unknown>).speed === "fast" ||
                (safeArgs.preferences as Record<string, unknown>).speed === "balanced" ||
                (safeArgs.preferences as Record<string, unknown>).speed === "cheap"
                  ? ((safeArgs.preferences as Record<string, unknown>).speed as "fast" | "balanced" | "cheap")
                  : undefined,
              minReputation:
                typeof (safeArgs.preferences as Record<string, unknown>).minReputation === "number"
                  ? ((safeArgs.preferences as Record<string, unknown>).minReputation as number)
                  : undefined
            }
          : undefined;

      return textResult(vend({ query, category, maxBudget, preferences }));
    }
    case "get_vend_status": {
      const vendId = requireString(safeArgs, "vendId");
      const record = getVend(vendId);

      if (!record) {
        throw new Error(`No vend request found for ${vendId}.`);
      }

      return textResult(record);
    }
    case "list_providers": {
      const category = validateCategory(safeArgs.category);
      return textResult({ providers: listProviders(category) });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function handleRequest(request: JsonRpcRequest): void {
  if (request.method === "initialize") {
    sendResult(request.id ?? null, {
      protocolVersion,
      capabilities: {
        tools: {
          listChanged: false
        }
      },
      serverInfo: {
        name: "vending-machine-mcp",
        title: "Vending Machine MCP",
        version: "0.1.0",
        description: "Minimal procurement MCP server for the Vending Machine MVP."
      },
      instructions:
        "Use vend_query to procure a result from mock providers. This MVP simulates negotiation and settlement."
    });
    return;
  }

  if (request.method === "notifications/initialized") {
    initialized = true;
    return;
  }

  if (!initialized) {
    sendError(request.id ?? null, -32002, "Server not initialized.");
    return;
  }

  if (request.method === "tools/list") {
    sendResult(request.id ?? null, { tools });
    return;
  }

  if (request.method === "tools/call") {
    try {
      const name = typeof request.params?.name === "string" ? request.params.name : "";
      const args =
        request.params?.arguments && typeof request.params.arguments === "object"
          ? (request.params.arguments as ToolCallArgs)
          : {};
      sendResult(request.id ?? null, handleToolCall(name, args));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool call failed.";
      sendError(request.id ?? null, -32000, message);
    }
    return;
  }

  sendError(request.id ?? null, -32601, `Method not found: ${request.method}`);
}

function drainBuffer(): void {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return;
    }

    const headerBlock = buffer.slice(0, headerEnd);
    const match = headerBlock.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = "";
      return;
    }

    const contentLength = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const totalLength = bodyStart + contentLength;

    if (buffer.length < totalLength) {
      return;
    }

    const body = buffer.slice(bodyStart, totalLength);
    buffer = buffer.slice(totalLength);

    try {
      const request = JSON.parse(body) as JsonRpcRequest;
      handleRequest(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON-RPC payload.";
      sendError(null, -32700, message);
    }
  }
}

stdin.setEncoding("utf8");
stdin.on("data", (chunk: string) => {
  buffer += chunk;
  drainBuffer();
});
