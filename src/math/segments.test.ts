import { describe, expect, it } from "vitest";
import { hasMath, isSafeTex, maskMath, splitMath, splitMasked, unmaskMath } from "./segments";

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

  it("follows Pandoc: a space before a closing $ ends the attempt instead of looking further", () => {
    // Pandoc reads "$5 each. Solve $" as no math, then finds $x^2=4$.
    expect(splitMath("Tickets cost $5 each. Solve $x^2=4$.")).toEqual([
      { kind: "text", text: "Tickets cost $5 each. Solve " },
      { kind: "math", tex: "x^2=4", display: false },
      { kind: "text", text: "." },
    ]);
    expect(splitMath("Costs $5 **each**, so $n$ cost $5n$.").filter((s) => s.kind === "math")).toEqual([
      { kind: "math", tex: "n", display: false },
      { kind: "math", tex: "5n", display: false },
    ]);
    // A closing $ followed by a digit means it was money, not math; nothing further is tried.
    expect(splitMath("$x$5")).toEqual([{ kind: "text", text: "$x$5" }]);
  });

  it("never runs math across a blank line", () => {
    expect(splitMath("Lunch is $8.\n\nSolve $x=1$.").filter((s) => s.kind === "math")).toEqual([
      { kind: "math", tex: "x=1", display: false },
    ]);
    expect(splitMath("$$a\n\nb$$")).toEqual([{ kind: "text", text: "$$a\n\nb$$" }]);
    // A single line break inside math is fine.
    expect(splitMath("$$x\n+1$$")).toEqual([{ kind: "math", tex: "x\n+1", display: true }]);
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

describe("maskMath", () => {
  it("swaps each expression for a token and puts it back", () => {
    const { text, math } = maskMath("**bold** and $a_1 + b_2$, `code $x$` and $$\\{y\\}$$");
    expect(text).not.toContain("a_1");
    expect(text).toContain("**bold** and ");
    expect(text).toContain("`code $x$`");
    expect(math).toEqual([
      { kind: "math", tex: "a_1 + b_2", display: false },
      { kind: "math", tex: "\\{y\\}", display: true },
    ]);
    expect(unmaskMath(text, math)).toBe("**bold** and $a_1 + b_2$, `code $x$` and $$\\{y\\}$$");
    expect(splitMasked(text, math).filter((s) => s.kind === "math")).toEqual(math);
  });

  it("ignores token characters that were already in the text", () => {
    const { text, math } = maskMath("odd \uE0007\uE001 text");
    expect(math).toEqual([]);
    expect(unmaskMath(text, math)).toBe("odd 7 text");
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

  it("cannot be bypassed with a digit or underscore after the command name", () => {
    // TeX command names are letters only: \href0 is \href followed by 0.
    expect(isSafeTex("\\href0{x}")).toBe(false);
    expect(isSafeTex("\\class1{a}{x}")).toBe(false);
    expect(isSafeTex("\\cssId0{a}{x}")).toBe(false);
    expect(isSafeTex("\\style_{x}")).toBe(false);
    expect(isSafeTex("\\htmlData{a=b}{x}")).toBe(false);
    // \bbox can draw a box of any size and colour over the page.
    expect(isSafeTex("\\bbox[red,300em]{x}")).toBe(false);
    // Longer names that only start the same way are fine.
    expect(isSafeTex("\\urlx")).toBe(true);
    expect(isSafeTex("\\stylex")).toBe(true);
  });
});
