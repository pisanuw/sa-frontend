import { describe, expect, it } from "vitest";
import { buildBrailleDocument, markdownLines, stripInlineMarkdown } from "./document";
import { mathInStemImage, stemImageBrailleWithMath } from "./stemImage";
import { toUeb } from "./ueb";

const text = (pages: string[][]) => pages.flat().join(" ").replace(/ +/g, " ");

describe("math in the braille file", () => {
  it("keeps TeX intact when stripping Markdown", () => {
    expect(stripInlineMarkdown("**Sum** $a_1 + b_2$ and _x_")).toBe("Sum $a_1 + b_2$ and x");
    expect(markdownLines("- Area: $\\pi r^2$")[0]).toEqual({ kind: "item", level: 1, text: "Area: $\\pi r^2$" });
  });

  it("writes math in Nemeth between the switch indicators and explains them", () => {
    const doc = buildBrailleDocument({
      title: "Circle",
      longDescription: "The area is $x^2$.",
      math: new Map([["x^2", "⠭⠘⠆"]]),
    });
    const t = text(doc.pages);
    expect(t).toContain("⠸⠩ ⠭⠘⠆ ⠸⠱⠲");
    expect(t).toContain(toUeb("Nemeth"));
  });

  it("falls back to the LaTeX source, and says so, when there is no Nemeth", () => {
    const doc = buildBrailleDocument({ title: "Circle", longDescription: "Area $x^2$" });
    const t = text(doc.pages);
    expect(t).toContain(toUeb("$x^2$"));
    expect(t).toContain(toUeb("LaTeX"));
    expect(t).not.toContain("⠸⠩");
  });

  it("finds the math to convert and converts it with the real engine", async () => {
    const input = {
      title: "Pythagoras",
      shortAlt: "Right triangle",
      summary: "## Formula\n\n$$x^2+y^2=r^2$$\n\nCosts $5 and $10.",
      data: { nodes: [], edges: [] },
      includeKey: false,
    };
    expect(mathInStemImage(input)).toEqual(["x^2+y^2=r^2"]);
    const doc = await stemImageBrailleWithMath(input);
    expect(text(doc.pages)).toContain("⠸⠩ ⠭⠘⠆⠐⠬⠽⠘⠆ ⠨⠅ ⠗⠘⠆ ⠸⠱");
    // Money is not math.
    expect(text(doc.pages)).toContain(toUeb("$5"));
  }, 30000);
});
