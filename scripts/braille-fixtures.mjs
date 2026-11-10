// Regenerate src/braille/fixtures/liblouis-ueb-g1.json from corpus.txt with liblouis.
// Needs `lou_translate` (Debian/Ubuntu: apt install liblouis-bin). Usage:
//   node scripts/braille-fixtures.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../src/braille/fixtures/", import.meta.url);
const corpus = readFileSync(new URL("corpus.txt", dir), "utf8").split("\n").filter(Boolean);
const version = execFileSync("lou_translate", ["--version"], { encoding: "utf8" }).split("\n")[0];

// lou_translate reads backslash escapes in its input, so double them.
const translate = (line) =>
  execFileSync("lou_translate", ["--forward", "en-ueb-g1.ctb"], {
    input: line.replace(/\\/g, "\\\\"),
    encoding: "utf8",
  }).replace(/\n$/, "");

const cases = corpus.map((input) => ({ input, liblouis: translate(input) }));
writeFileSync(
  new URL("liblouis-ueb-g1.json", dir),
  JSON.stringify({ generator: version, table: "en-ueb-g1.ctb", cases }, null, 2) + "\n"
);
console.log(`${cases.length} cases from ${version}`);
