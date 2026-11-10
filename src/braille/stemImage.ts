// The braille file for one STEM image, built the same way on shared pages and in Export.

import type { FlowchartData } from "../types/types";
import { buildBrailleDocument, type BrailleDocument } from "./document";
import { flowchartKey } from "./tactileKey";

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
};

export function stemImageBraille(input: StemImageBrailleInput): BrailleDocument {
  return buildBrailleDocument({
    title: input.title?.trim() || "STEM image",
    altText: input.shortAlt,
    longDescription: input.summary,
    key: input.includeKey && input.data.nodes.length ? flowchartKey(input.data).entries : undefined,
    source: input.source,
  });
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
