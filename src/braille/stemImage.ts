// The braille file for one STEM image, built the same way on shared pages and in Export.

import type { FlowchartData } from "../types/types";
import { buildBrailleDocument, type BrailleDocument } from "./document";
import { flowchartKey } from "./tactileKey";
import { splitMath } from "../math/segments";

export type StemImageBrailleInput = {
  title?: string | null;
  shortAlt?: string | null;
  /** Long description as Markdown. */
  summary?: string | null;
  data: FlowchartData;
  /**
   * Include the key of the numbered tactile graphic. Leave it off when the tactile view prints
   * the values themselves in braille (data structures with short labels), since that graphic
   * has no key.
   */
  includeKey: boolean;
  /** Shared page address, written into the transcriber's note. */
  source?: string | null;
  /** Nemeth for each TeX expression, from `nemethForMath`. */
  math?: Map<string, string | null>;
};

export function stemImageBraille(input: StemImageBrailleInput): BrailleDocument {
  return buildBrailleDocument({
    title: input.title?.trim() || "STEM image",
    altText: input.shortAlt,
    longDescription: input.summary,
    key: input.includeKey && input.data.nodes.length ? flowchartKey(input.data).entries : undefined,
    source: input.source,
    math: input.math,
  });
}

/** Every TeX expression in the text that goes into the braille file. */
export function mathInStemImage(input: StemImageBrailleInput): string[] {
  const texts = [input.title, input.shortAlt, input.summary];
  if (input.includeKey) texts.push(...input.data.nodes.map((n) => n.label));
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const seg of splitMath(text, { skipCode: true })) if (seg.kind === "math") found.add(seg.tex);
  }
  return [...found];
}

/**
 * Nemeth for each expression. Loads the math engine only when there is math; if it cannot load,
 * every expression maps to null and the file shows the LaTeX instead.
 */
export async function nemethForMath(texs: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!texs.length) return map;
  try {
    const { loadMathEngine } = await import("../math/engine");
    const engine = await loadMathEngine();
    for (const tex of texs) map.set(tex, engine.nemeth(tex));
  } catch (e) {
    console.error("Math engine did not load; math stays as LaTeX in the braille file.", e);
    for (const tex of texs) map.set(tex, null);
  }
  return map;
}

/** The braille file with its math in Nemeth, for one-off downloads such as Export. */
export async function stemImageBrailleWithMath(input: StemImageBrailleInput): Promise<BrailleDocument> {
  return stemImageBraille({ ...input, math: await nemethForMath(mathInStemImage(input)) });
}

export function brfFileName(title?: string | null): string {
  const base =
    (title || "stem-image").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "stem-image";
  return `${base}.brf`;
}

/** Save a .brf file. BRF is plain ASCII, so it opens on embossers, notetakers and braille apps. */
export function downloadBrf(fileName: string, brf: string): void {
  const url = URL.createObjectURL(new Blob([brf], { type: "text/plain;charset=us-ascii" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
