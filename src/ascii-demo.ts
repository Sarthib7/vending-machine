const frames = [
  String.raw`
        _________________________________
       /  _____________________________  \
      /  / THE VENDING MACHINE       /|  \
     /__/___________________________/ |___\
     |  |                           | |   |
     |  |  [ compliance ]   $0.42   | |   |
     |  |  [ b2b_data   ]   $0.21   | |   |
     |  |  [ ai_infer   ]   $0.11   | |   |
     |  |---------------------------| |   |
     |  |  query  : sanctions       | |   |
     |  |  budget : $1.00           | |   |
     |  |  state  : routing         | |   |
     |  |___________________________| |   |
     | /__________ DISPENSE ________\ |   |
     |/_____________ RESULT _________\|   |
     /___________________________________\
        |   [][][]   | MCP |   [][][]   |
        |____________|_____|____________|
           /   /                 \   \
          /___/                   \___/
`,
  String.raw`
        _________________________________
       /  _____________________________  \
      /  / THE VENDING MACHINE       /|  \
     /__/___________________________/ |___\
     |  |                           | |   |
     |  |  provider A     $0.57     | |   |
     |  |  provider B     $0.42     | |   |
     |  |  provider C     $0.61     | |   |
     |  |---------------------------| |   |
     |  |  state  : auction live    | |   |
     |  |  bids   : 3               | |   |
     |  |  rank   : recalculating   | |   |
     |  |___________________________| |   |
     | /__________ DISPENSE ________\ |   |
     |/_____________ RESULT _________\|   |
     /___________________________________\
        |   [][][]   | 402 |   [][][]   |
        |____________|_____|____________|
           /   /                 \   \
          /___/                   \___/
`,
  String.raw`
        _________________________________
       /  _____________________________  \
      /  / THE VENDING MACHINE       /|  \
     /__/___________________________/ |___\
     |  |                           | |   |
     |  |  rank #1  B  $0.42 180ms  | |   |
     |  |  rank #2  A  $0.57 240ms  | |   |
     |  |  rank #3  C  $0.61 310ms  | |   |
     |  |---------------------------| |   |
     |  |  state  : winner locked   | |   |
     |  |  fee    : $0.06           | |   |
     |  |  total  : $0.48           | |   |
     |  |___________________________| |   |
     | /__________ DISPENSE ________\ |   |
     |/_____________ RESULT _________\|   |
     /___________________________________\
        |   [][][]   | PAY |   [][][]   |
        |____________|_____|____________|
           /   /                 \   \
          /___/                   \___/
`,
  String.raw`
        _________________________________
       /  _____________________________  \
      /  / THE VENDING MACHINE       /|  \
     /__/___________________________/ |___\
     |  |                           | |   |
     |  |  entity : Acme Corp       | |   |
     |  |  match  : false           | |   |
     |  |  source : OFAC / EU / UN  | |   |
     |  |---------------------------| |   |
     |  |  state  : complete        | |   |
     |  |  receipt: attached        | |   |
     |  |  mode   : MPP + x402n     | |   |
     |  |___________________________| |   |
     | /__________ DISPENSE ________\ |   |
     |/___________ SANCTIONS ________\|   |
     /___________________________________\
        |   [][][]   | OK! |   [][][]   |
        |____________|_____|____________|
           /   /                 \   \
          /___/                   \___/
`,
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  process.stdout.write("\x1b[2J\x1b[?25l");

  for (let i = 0; i < 2; i += 1) {
    for (const frame of frames) {
      process.stdout.write("\x1b[H\x1b[36m");
      process.stdout.write(`${frame}\n`);
      process.stdout.write("\x1b[0m");
      await sleep(500);
    }
  }

  process.stdout.write("The Vending Machine demo complete. Run `npm run demo:ascii` any time.\n");
  process.stdout.write("\x1b[?25h");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.stdout.write("\x1b[?25h");
  process.exitCode = 1;
});
