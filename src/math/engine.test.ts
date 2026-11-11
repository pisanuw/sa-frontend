import { describe, expect, it } from "vitest";
import { loadMathEngine } from "./engine";

describe("math engine (MathJax TeX input + Speech Rule Engine)", () => {
  it("writes Nemeth braille", async () => {
    const e = await loadMathEngine();
    // Superscripts, the baseline indicator before +, spaces around the comparison sign.
    expect(e.nemeth("x^2+y^2=r^2")).toBe("⠭⠘⠆⠐⠬⠽⠘⠆⠀⠨⠅⠀⠗⠘⠆");
    // Fraction indicators with the digit in the lower position.
    expect(e.nemeth("\\frac{a+b}{2}")).toBe("⠹⠁⠬⠃⠌⠆⠼");
    expect(e.nemeth("3x - 5 \\le 7")).toBe("⠼⠒⠭⠤⠢⠀⠐⠅⠱⠀⠼⠶");
  }, 30000);

  it("returns null for TeX errors and unsafe commands", async () => {
    const e = await loadMathEngine();
    expect(e.nemeth("\\frac{1}")).toBeNull();
    expect(e.nemeth("\\notacommand x")).toBeNull();
    expect(e.nemeth("\\href{https://example.com}{x}")).toBeNull();
    expect(e.mathml("x")).toContain("<math");
  }, 30000);
});
