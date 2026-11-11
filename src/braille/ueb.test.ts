import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fixtures from "./fixtures/liblouis-ueb-g1.json";
import { translateUeb, toUeb, brailleNumber } from "./ueb";
import { unicodeToAsciiBraille } from "./brf";

/** liblouis prints lowercase ASCII braille; ours is the uppercase (0x20-0x5F) form of the same cells. */
const liblouisToUpper = (s: string) =>
  s.replace(/[a-z`~|{}]/g, (ch) =>
    ch >= "a" && ch <= "z"
      ? ch.toUpperCase()
      : ({ "`": "@", "~": "^", "|": "\\", "{": "[", "}": "]" } as Record<string, string>)[ch]
  );

const ascii = (text: string) => unicodeToAsciiBraille(toUeb(text));

describe("uncontracted UEB matches liblouis en-ueb-g1", () => {
  for (const { input, liblouis } of fixtures.cases) {
    it(input, () => {
      expect(ascii(input)).toBe(liblouisToUpper(liblouis));
    });
  }
});

describe("rules worth stating on their own", () => {
  it("puts the numeric indicator before numbers and the grade 1 indicator before a-j after a digit", () => {
    expect(toUeb("3d")).toBe("⠼⠉⠰⠙");
    expect(toUeb("3k")).toBe("⠼⠉⠅");
    expect(toUeb("10")).toBe("⠼⠁⠚");
  });

  it("uses letter, word and passage capitals", () => {
    expect(toUeb("A")).toBe("⠠⠁");
    expect(toUeb("AB")).toBe("⠠⠠⠁⠃");
    expect(toUeb("ABc")).toBe("⠠⠠⠁⠃⠠⠄⠉");
    expect(toUeb("A B C")).toBe("⠠⠠⠠⠁ ⠃ ⠉⠠⠄");
  });

  it("writes subscripts and superscripts as level changes", () => {
    expect(toUeb("H₂O")).toBe("⠠⠓⠰⠢⠼⠃⠠⠕");
    expect(toUeb("x²")).toBe("⠭⠰⠔⠼⠃");
  });

  it("keeps newlines and reports characters it cannot show", () => {
    const r = translateUeb("a\nb ☃");
    expect(r.braille).toBe("⠁\n⠃ ⠿");
    expect(r.unknown).toEqual(["☃"]);
  });

  it("formats numbers for keys and page numbers", () => {
    expect(brailleNumber(1)).toBe("⠼⠁");
    expect(brailleNumber(12)).toBe("⠼⠁⠃");
  });
});

// With liblouis installed (apt install liblouis-bin), also compare against it live, so a newer
// liblouis that changes its output shows up here.
const hasLiblouis = spawnSync("lou_translate", ["--version"]).status === 0;
describe.skipIf(!hasLiblouis)("live comparison with the installed liblouis", () => {
  it("agrees on the whole corpus", () => {
    const input = fixtures.cases.map((c) => c.input.replace(/\\/g, "\\\\")).join("\n");
    const r = spawnSync("lou_translate", ["--forward", "en-ueb-g1.ctb"], { input, encoding: "utf8" });
    const lines = r.stdout.replace(/\n$/, "").split("\n");
    expect(lines.map(liblouisToUpper)).toEqual(fixtures.cases.map((c) => ascii(c.input)));
  });
});
