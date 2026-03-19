import type { Provider, VendRecord } from "./types.js";

const SCREEN_WIDTH = 32;

function supportsColor(): boolean {
  return Boolean(process.stdout.isTTY && !process.env.NO_COLOR);
}

function tint(text: string, code: number): string {
  return supportsColor() ? `\x1b[${code}m${text}\x1b[0m` : text;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : `${value}${" ".repeat(width - value.length)}`;
}

function shorten(value: string, width: number): string {
  return value.length <= width ? value : `${value.slice(0, Math.max(0, width - 1))}~`;
}

function box(title: string, body: string[], ticket?: string[]): string {
  const lines = [
    `.${"-".repeat(SCREEN_WIDTH + 2)}.`,
    `| ${pad(title, SCREEN_WIDTH)} |`,
    `|${"-".repeat(SCREEN_WIDTH + 2)}|`,
    ...body.map((line) => `| ${pad(line, SCREEN_WIDTH)} |`),
    `|${"_".repeat(SCREEN_WIDTH + 2)}|`
  ];

  if (!ticket) {
    return `${lines.join("\n")}\n        \\\\____________//`;
  }

  return [
    ...lines,
    "           \\\\      //",
    "            \\\\____//",
    ...ticket.map((line) => `             ${line}`)
  ].join("\n");
}

function offerLine(label: string, price: string, latency: string, active = false): string {
  return `${active ? ">" : " "} ${pad(shorten(label, 10), 10)} ${pad(price, 5)} ${pad(latency, 6)}`;
}

export function renderDemoFrames(): string[] {
  return [
    box("THE VENDING MACHINE", [
      "query  : sanctions screen",
      "budget : $1.00",
      "state  : routing",
      "",
      "  .  .  o",
      "",
      "finding providers"
    ]),
    box("THE VENDING MACHINE", [
      "query  : sanctions screen",
      "budget : $1.00",
      "state  : auction live",
      "",
      offerLine("A1", "$0.57", "240ms"),
      offerLine("B4", "$0.42", "180ms", true),
      offerLine("C7", "$0.61", "310ms")
    ]),
    box("THE VENDING MACHINE", [
      "winner : B4",
      "fee    : $0.06",
      "total  : $0.48",
      "state  : paid",
      "",
      "  o  o  o",
      "",
      "receipt attached"
    ]),
    box(
      "THE VENDING MACHINE",
      [
        "result : dispensed",
        "entity : Acme Corp",
        "match  : false",
        "source : OFAC / EU / UN",
        "",
        "  o  o  o",
        "",
        "done"
      ],
      [".----------------.", "| sanctions report |", "| match : false    |", "'----------------'"]
    )
  ];
}

export async function animateDemo(loops = 2, delayMs = 520): Promise<void> {
  process.stdout.write("\x1b[2J\x1b[?25l");

  try {
    for (let i = 0; i < loops; i += 1) {
      for (const frame of renderDemoFrames()) {
        process.stdout.write("\x1b[H");
        process.stdout.write(tint(`${frame}\n`, 38));
        process.stdout.write(tint("  route  ->  auction  ->  mpp  ->  dispense\n", 90));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  } finally {
    process.stdout.write("\x1b[0m\x1b[?25h");
  }
}

export function renderProviders(providers: Provider[]): string {
  return [
    "category         provider                  price    latency",
    ...providers.map((provider) =>
      `${pad(shorten(provider.category, 16), 16)} ${pad(shorten(provider.name, 25), 25)} ${pad(`$${provider.basePrice.toFixed(2)}`, 8)} ${provider.avgLatencyMs}ms`
    )
  ].join("\n");
}

export function renderVendSummary(record: VendRecord): string {
  const offers = record.negotiation?.offers.slice(0, 3) ?? [];

  return box(
    "THE VENDING MACHINE",
    [
      `query  : ${shorten(record.query, 20)}`,
      `budget : $${record.maxBudget.toFixed(2)}`,
      `winner : ${shorten(record.provider?.name ?? "n/a", 20)}`,
      `total  : $${record.cost?.total.toFixed(2) ?? "0.00"}`,
      "",
      ...offers.map((offer, index) =>
        offerLine(
          `#${index + 1} ${offer.providerName.slice(0, 7)}`,
          `$${offer.price.toFixed(2)}`,
          `${offer.latencyMs}ms`,
          index === 0
        )
      ),
      ""
    ],
    [".----------------.", `| ${pad(record.category, 14)} |`, "'----------------'"]
  );
}
