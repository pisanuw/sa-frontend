// The key for a flowchart's tactile graphic, shared by the drawing, the on-screen key and the
// braille file so the three always agree.

import type { FlowchartData } from "../types/types";
import { brailleNumber, toUeb } from "./ueb";

/** Edge labels this short (in braille cells) are written on the line itself, not keyed. */
export const DIRECT_LABEL_MAX_CELLS = 5;

export type KeyEntry = {
  kind: "node" | "edge";
  /** Print form of the key symbol: "1" for a shape, "a" for a line label. */
  print: string;
  /** The symbol in braille, as it appears on the graphic. */
  braille: string;
  /** The text it stands for. */
  label: string;
};

export type FlowchartKey = {
  /** Shape symbol by node id. */
  nodes: Map<string, KeyEntry>;
  /** What is written on each labelled line, by label text: a key letter or the label itself. */
  edgeLabels: Map<string, { braille: string; keyed: KeyEntry | null }>;
  /** Everything a reader needs to look up, in key order: shapes, then keyed line labels. */
  entries: KeyEntry[];
};

/** a, b, … z, aa, ab, … */
function keyLetters(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function flowchartKey(data: FlowchartData): FlowchartKey {
  const nodes = new Map<string, KeyEntry>();
  const entries: KeyEntry[] = [];
  data.nodes.forEach((n, i) => {
    const e: KeyEntry = {
      kind: "node",
      print: String(i + 1),
      braille: brailleNumber(i + 1),
      label: n.label?.trim() || "Unnamed step",
    };
    nodes.set(n.id, e);
    entries.push(e);
  });

  const edgeLabels = new Map<string, { braille: string; keyed: KeyEntry | null }>();
  let letter = 0;
  for (const edge of data.edges) {
    const label = edge.label?.trim();
    if (!label || edgeLabels.has(label)) continue;
    const direct = toUeb(label);
    if (direct.length <= DIRECT_LABEL_MAX_CELLS && !direct.includes(" ")) {
      edgeLabels.set(label, { braille: direct, keyed: null });
      continue;
    }
    const print = keyLetters(letter++);
    const e: KeyEntry = { kind: "edge", print, braille: toUeb(print), label };
    edgeLabels.set(label, { braille: e.braille, keyed: e });
    entries.push(e);
  }
  return { nodes, edgeLabels, entries };
}
