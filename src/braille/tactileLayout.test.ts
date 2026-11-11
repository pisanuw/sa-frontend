import { describe, expect, it } from "vitest";
import { brailleDots, brailleWidth, layoutTactileFlowchart, BRAILLE_MM } from "./tactileLayout";
import { flowchartKey } from "./tactileKey";
import { parseMermaidText } from "../lib/mermaidText";
import type { FlowchartData } from "../types/types";

const scene = (data: FlowchartData, title = "") => layoutTactileFlowchart(data, flowchartKey(data), title)!;

const decision = parseMermaidText(
  "flowchart TD\n A([Start]) --> B{Ready?}\n B -- Yes --> C[Go]\n B -- Not yet ready --> D[Wait]"
).data;

describe("braille dots", () => {
  it("places dots at standard spacing", () => {
    // ⠼ is dots 3, 4, 5, 6.
    expect(brailleDots("⠼", 0, 0)).toEqual([
      { cx: 0, cy: 2 * BRAILLE_MM.dotSpacing },
      { cx: BRAILLE_MM.dotSpacing, cy: 0 },
      { cx: BRAILLE_MM.dotSpacing, cy: BRAILLE_MM.dotSpacing },
      { cx: BRAILLE_MM.dotSpacing, cy: 2 * BRAILLE_MM.dotSpacing },
    ]);
    const second = brailleDots("⠁⠁", 0, 0)[1];
    expect(second.cx).toBeCloseTo(BRAILLE_MM.cellSpacing);
    expect(brailleWidth(2)).toBeCloseTo(6.2 + 2.5 + 1.5);
  });
});

describe("tactile flowchart layout", () => {
  it("draws a single shape without NaN (it used to divide by zero)", () => {
    const s = scene({ nodes: [{ id: "A", label: "Only", shape: "rectangle", coordinates: [[5, 5], [50, 30]] }], edges: [] });
    expect(s.shapes).toHaveLength(1);
    expect(Number.isFinite(s.shapes[0].cx) && Number.isFinite(s.shapes[0].cy)).toBe(true);
  });

  it("keeps every shape on the page and labels shapes with braille numbers", () => {
    const s = scene(decision, "Launch");
    for (const sh of s.shapes) {
      expect(sh.cx - sh.w / 2).toBeGreaterThanOrEqual(0);
      expect(sh.cx + sh.w / 2).toBeLessThanOrEqual(s.width);
      expect(sh.cy - sh.h / 2).toBeGreaterThanOrEqual(0);
      expect(sh.cy + sh.h / 2).toBeLessThanOrEqual(s.height);
    }
    expect(s.shapes.map((x) => x.braille)).toEqual(["⠼⠁", "⠼⠃", "⠼⠉", "⠼⠙"]);
    expect(s.overlaps).toBe(0);
    expect(s.title.length).toBeGreaterThan(0);
  });

  it("stops lines outside the shapes and labels them like the key", () => {
    const s = scene(decision);
    expect(s.lines).toHaveLength(3);
    for (const l of s.lines) {
      for (const sh of s.shapes) {
        const inside = (x: number, y: number) => {
          const dx = Math.abs(x - sh.cx) / (sh.w / 2);
          const dy = Math.abs(y - sh.cy) / (sh.h / 2);
          if (sh.kind === "diamond") return dx + dy < 0.99;
          if (sh.kind === "ellipse") return dx * dx + dy * dy < 0.99;
          return dx < 0.99 && dy < 0.99;
        };
        expect(inside(l.x1, l.y1) || inside(l.x2, l.y2)).toBe(false);
      }
    }
    const labels = s.lines.map((l) => l.label?.braille ?? null);
    expect(labels).toContain("⠠⠽⠑⠎"); // "Yes", written on the line
    expect(labels).toContain("⠁"); // "Not yet ready", keyed as a
    expect(s.lines.every((l) => l.arrowEnd)).toBe(true);
  });

  it("reports shapes that sit on top of each other", () => {
    const s = scene({
      nodes: [
        { id: "A", label: "A", shape: "rectangle", coordinates: [[0, 0], [10, 10]] },
        { id: "B", label: "B", shape: "rectangle", coordinates: [[1, 0], [11, 10]] },
        { id: "C", label: "C", shape: "rectangle", coordinates: [[400, 600], [410, 610]] },
      ],
      edges: [],
    });
    expect(s.overlaps).toBe(1);
  });
});
