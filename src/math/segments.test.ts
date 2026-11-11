import { describe, expect, it } from "vitest";
import { hasMath, isSafeTex, protectMathInMarkdown, splitMath } from "./segments";

describe("splitMath", () => {
  it("finds inline and displayed math", () => {
    expect(splitMath("Area is $\\pi r^2$ here")).toEqual([
      { kind: "text", text: "Area is " },
      { kind: "math", tex: "\\pi r^2", display: false },
      { kind: "text", text: " here" },
    ]);
    expect(splitMath("$$\\frac{a}{b}$$")).toEqual([{ kind: "math", tex: "\\frac{a}{b}", display: true }]);
  });

  it("leaves money and lone dollars alone", () => {
    expect(splitMath("It costs $5 and $10.")).toEqual([{ kind: "text", text: "It costs $5 and $10." }]);
    expect(splitMath("$ 5 $")).toEqual([{ kind: "text", text: "$ 5 $" }]);
    expect(splitMath("price: $20")).toEqual([{ kind: "text", text: "price: $20" }]);
    expect(splitMath("a \\$ sign $x$")).toEqual([
      { kind: "text", text: "a \\$ sign " },
      { kind: "math", tex: "x", display: false },
    ]);
  });

  it("does not let an escaped dollar close math", () => {
    expect(splitMath("$a \\$ b$")).toEqual([{ kind: "math", tex: "a \\$ b", display: false }]);
  });

  it("skips code in Markdown when asked", () => {
    const md = "Run `echo $HOME and $PATH` then $x$\n```\n$y$\n```\n";
    const math = splitMath(md, { skipCode: true }).filter((s) => s.kind === "math");
    expect(math).toEqual([{ kind: "math", tex: "x", display: false }]);
    expect(hasMath("no math, just $5")).toBe(false);
    expect(hasMath("has $a_1$")).toBe(true);
  });
});

describe("protectMathInMarkdown", () => {
  it("escapes Markdown punctuation inside math only", () => {
    expect(protectMathInMarkdown("**bold** and $a_1 + b_2$")).toBe("**bold** and $a\\_1 \\+ b\\_2$");
    expect(protectMathInMarkdown("$\\{x\\}$")).toBe("$\\\\\\{x\\\\\\}$");
  });
});

describe("isSafeTex", () => {
  it("refuses commands that add links, styles or extensions", () => {
    expect(isSafeTex("\\frac{1}{2}")).toBe(true);
    expect(isSafeTex("\\href{javascript:alert(1)}{x}")).toBe(false);
    expect(isSafeTex("\\style{color:red}{x}")).toBe(false);
    expect(isSafeTex("\\require{html}")).toBe(false);
    expect(isSafeTex("x".repeat(3000))).toBe(false);
  });
});
