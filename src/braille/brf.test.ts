import { describe, expect, it } from "vitest";
import { layoutPages, pagesToBrf, unicodeToAsciiBraille } from "./brf";
import { buildBrailleDocument, markdownLines, stripInlineMarkdown } from "./document";
import { flowchartKey } from "./tactileKey";
import { toUeb } from "./ueb";
import type { FlowchartData } from "../types/types";

describe("ASCII braille", () => {
  it("maps cells to North American ASCII braille", () => {
    expect(unicodeToAsciiBraille("⠠⠓⠑⠇⠇⠕ ⠼⠁⠃")).toBe(",HELLO #AB");
    expect(unicodeToAsciiBraille("⠈⠘⠸⠳⠪⠻")).toBe("@^_\\[]");
  });
});

describe("page layout", () => {
  const word = (n: number) => "⠁".repeat(n);

  it("wraps at 40 cells without splitting words", () => {
    const text = Array.from({ length: 20 }, () => word(5)).join(" ");
    const [page] = layoutPages([{ kind: "indented", text, first: 2, runover: 0 }], { pageNumbers: false });
    expect(page.every((l) => l.length <= 40)).toBe(true);
    expect(page[0].startsWith("  ⠁")).toBe(true);
    expect(page[1].startsWith("⠁")).toBe(true);
    expect(page.join(" ").split(/ +/).filter(Boolean)).toHaveLength(20);
  });

  it("divides a word longer than a line", () => {
    const [page] = layoutPages([{ kind: "indented", text: word(50), first: 0, runover: 0 }], {
      pageNumbers: false,
    });
    expect(page.map((l) => l.length)).toEqual([40, 10]);
  });

  it("starts a new page after 25 lines, with the page number alone on line 1", () => {
    const blocks = Array.from({ length: 30 }, () => ({
      kind: "indented" as const,
      text: word(3),
      first: 0,
      runover: 0,
    }));
    const pages = layoutPages(blocks);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(25);
    expect(pages[0][0].trim()).toBe(toUeb("1"));
    expect(pages[0][0]).toHaveLength(40);
    expect(pages[1][0].trim()).toBe(toUeb("2"));
  });

  it("moves a heading to the next page instead of ending a page with it", () => {
    const filler = Array.from({ length: 23 }, () => ({
      kind: "indented" as const,
      text: "⠁",
      first: 0,
      runover: 0,
    }));
    const pages = layoutPages([
      ...filler,
      { kind: "indented", text: "⠓", first: 4, runover: 4, keepWithNext: true },
      { kind: "indented", text: "⠃", first: 2, runover: 0 },
    ]);
    expect(pages[0]).toHaveLength(24);
    expect(pages[1].slice(1)).toEqual(["    ⠓", "  ⠃"]);
  });

  it("never leaves a blank line at the top of a page", () => {
    const blocks = [{ kind: "blank" as const }, { kind: "indented" as const, text: "⠁", first: 0, runover: 0 }];
    expect(layoutPages(blocks, { pageNumbers: false })[0]).toEqual(["⠁"]);
  });

  it("writes CR LF line ends and form feeds between pages", () => {
    const brf = pagesToBrf([["⠁", "⠃"], ["⠉"]]);
    expect(brf).toBe("A\r\nB\r\n\fC\r\n");
  });
});

describe("Markdown to braille structure", () => {
  it("strips inline marks", () => {
    expect(stripInlineMarkdown("**Bold** and *it* and `code` and [link](http://x)")).toBe(
      "Bold and it and code and link"
    );
    expect(stripInlineMarkdown("snake_case_name stays")).toBe("snake_case_name stays");
  });

  it("finds headings, nested list items and paragraphs", () => {
    const md = "## Steps\n\n- “Start”, then\n- Choose:\n  - If “Yes”:\n    - “Go”.\n\nA closing line\nthat wraps.";
    expect(markdownLines(md)).toEqual([
      { kind: "heading", level: 2, text: "Steps" },
      { kind: "item", level: 1, text: "“Start”, then" },
      { kind: "item", level: 1, text: "Choose:" },
      { kind: "item", level: 2, text: "If “Yes”:" },
      { kind: "item", level: 3, text: "“Go”." },
      { kind: "paragraph", text: "A closing line that wraps." },
    ]);
  });
});

const flow: FlowchartData = {
  nodes: [
    { id: "A", label: "Start", shape: "round-rectangle", coordinates: [[0, 0], [100, 40]] },
    { id: "B", label: "Ready?", shape: "diamond", coordinates: [[0, 100], [100, 140]] },
    { id: "C", label: "Go", shape: "rectangle", coordinates: [[-100, 200], [0, 240]] },
    { id: "D", label: "Wait", shape: "rectangle", coordinates: [[100, 200], [200, 240]] },
  ],
  edges: [
    { source: "A", destination: "B" },
    { source: "B", destination: "C", label: "Yes" },
    { source: "B", destination: "D", label: "Not yet ready" },
  ],
};

describe("tactile key", () => {
  it("numbers shapes, writes short line labels directly and letters long ones", () => {
    const key = flowchartKey(flow);
    expect(key.nodes.get("A")?.braille).toBe("⠼⠁");
    expect(key.nodes.get("D")?.print).toBe("4");
    expect(key.edgeLabels.get("Yes")).toEqual({ braille: toUeb("Yes"), keyed: null });
    expect(key.edgeLabels.get("Not yet ready")?.keyed?.print).toBe("a");
    expect(key.entries.map((e) => e.print)).toEqual(["1", "2", "3", "4", "a"]);
  });
});

describe("braille document", () => {
  it("holds the title, a transcriber's note, alt text, description and key, within page limits", () => {
    const doc = buildBrailleDocument({
      title: "Launch",
      altText: "A flowchart with 4 steps.",
      longDescription: "## Steps\n\n- Start\n- Ready?\n",
      key: flowchartKey(flow).entries,
      source: "https://stem-access.org/p/launch",
    });
    const text = doc.pages.flat().join("\n");
    expect(text).toContain(toUeb("Launch"));
    expect(text).toContain("⠈⠨⠣");
    expect(text).toContain(toUeb("Alt text"));
    expect(text).toContain(toUeb("Tactile graphic key"));
    expect(text).toContain(`⠼⠁ ${toUeb("Start")}`);
    expect(text).toContain(`⠁ ${toUeb("Not yet ready")}`);
    for (const page of doc.pages) {
      expect(page.length).toBeLessThanOrEqual(25);
      for (const line of page) expect(line.length).toBeLessThanOrEqual(40);
    }
    expect(doc.brf).toMatch(/^[\x20-\x5F\r\n\f]+$/);
    expect(doc.unknown).toEqual([]);
  });

  it("explains the placeholder when a character has no braille", () => {
    const doc = buildBrailleDocument({ title: "Snow ☃", altText: "x" });
    expect(doc.unknown).toEqual(["☃"]);
    const words = doc.pages.flat().join(" ").split(/ +/);
    expect(words).toContain(toUeb("marks"));
    expect(words.filter((w) => w === "⠿")).toHaveLength(2);
  });
});
