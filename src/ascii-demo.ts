const frames = [
  String.raw`
      .------------------------.
      |  THE VENDING MACHINE   |
      |------------------------|
      |  query   sanctions     |
      |  budget  $1.00         |
      |                        |
      |  [ ] [ ] [ ]           |
      |  [ ] [ ] [ ]           |
      |                        |
      |  state   routing       |
      '-----------..-----------'
                  ||
                  ||
`,
  String.raw`
      .------------------------.
      |  THE VENDING MACHINE   |
      |------------------------|
      |  A1  $0.57   240ms     |
      |  B4  $0.42   180ms     |
      |  C7  $0.61   310ms     |
      |                        |
      |  [ ] [ ] [ ]           |
      |  [ ] [ ] [ ]           |
      |                        |
      |  state   auction       |
      '-----------..-----------'
                  ||
                  ||
`,
  String.raw`
      .------------------------.
      |  THE VENDING MACHINE   |
      |------------------------|
      |  #1 B4  $0.42  180ms   |
      |  #2 A1  $0.57  240ms   |
      |  fee       $0.06       |
      |  total     $0.48       |
      |                        |
      |  [ ] [*] [ ]           |
      |                        |
      |  state   paid          |
      '-----------..-----------'
                  ||
                  ||
`,
  String.raw`
      .------------------------.
      |  THE VENDING MACHINE   |
      |------------------------|
      |  result  dispensed     |
      |  entity  Acme Corp     |
      |  match   false         |
      |  source  OFAC/EU/UN    |
      |                        |
      |  [ ] [ ] [ ]           |
      |________________________|
            \  sanctions  /
             \  report   /
              '--------'
`
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  process.stdout.write("\x1b[2J\x1b[?25l");

  for (let i = 0; i < 2; i += 1) {
    for (const frame of frames) {
      process.stdout.write("\x1b[H\x1b[38;5;223m");
      process.stdout.write(`${frame}\n`);
      process.stdout.write("\x1b[38;5;244m");
      process.stdout.write("      procurement  |  auction  |  mpp  |  dispense\n");
      process.stdout.write("\x1b[0m");
      await sleep(520);
    }
  }

  process.stdout.write("\x1b[?25h");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.stdout.write("\x1b[?25h");
  process.exitCode = 1;
});
