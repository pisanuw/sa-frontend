// The Braille view and the Export braille file must agree on whether the file includes the
// tactile graphic's key, and downloads share one file-name rule.
import { describe, expect, it } from "vitest";
import { tactileViewHasKey } from "./typed/TypedViews";
import { fileNameBase } from "../exports/export-utils";
import { parseMermaidText } from "../../lib/mermaidText";
import type { FlowchartData } from "../../types/types";

const flowchart = parseMermaidText(
  "flowchart TD\n A([Start]) --> B{Ready?}\n B -- Yes --> C[Go]\n B -- No --> D[Wait]"
).data;

const list = (labels: string[]): FlowchartData => ({
  nodes: labels.map((label, i) => ({
    id: `n${i}`,
    label,
    shape: "rectangle",
    coordinates: [[i * 100, 0], [i * 100 + 60, 40]],
  })),
  edges: labels.slice(1).map((_, i) => ({
    id: `e${i}`,
    source: `n${i}`,
    destination: `n${i + 1}`,
    type: "solid",
    arrowheads: ["end"],
  })),
});

describe("tactileViewHasKey", () => {
  it("is true for flowcharts, so both braille files include the numbered key", () => {
    expect(tactileViewHasKey("flowchart", flowchart)).toBe(true);
  });

  it("is false for a linked list whose short values are printed on the graphic", () => {
    expect(tactileViewHasKey("ll", list(["3", "7", "12"]))).toBe(false);
  });

  it("is true for a linked list whose values are too long to print, which gets the key", () => {
    expect(tactileViewHasKey("ll", list(["first value", "second value"]))).toBe(true);
  });
});

describe("fileNameBase", () => {
  it("joins lowercase letters and digits with hyphens", () => {
    expect(fileNameBase("Lab 2: Loops & Ifs")).toBe("lab-2-loops-ifs");
    expect(fileNameBase("  --Binary/Search--  ")).toBe("binary-search");
  });

  it("falls back when nothing is left", () => {
    expect(fileNameBase("")).toBe("stem-image");
    expect(fileNameBase(null)).toBe("stem-image");
    expect(fileNameBase("???")).toBe("stem-image");
    expect(fileNameBase("", "tactile")).toBe("tactile");
  });
});
