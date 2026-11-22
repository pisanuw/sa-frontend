import { autoDescribe } from "../arboretum/autoDescription";
import type { FlowchartData } from "../types/types";
import type { LongDescriptionSectionKey } from "../types/longDescription";
import {
  buildLongDescriptionMarkdown,
  createEmptyLongDescriptionSections,
} from "./longDescription";

export type DeckSummary = { id: string; filename: string; page_count: number };
export type DeckDiagram = {
  id: string;
  page_number: number;
  position: number;
  title: string;
  kind: string;
  status: "queued" | "processing" | "awaiting_description" | "ready" | "failed";
  error: string | null;
  flowchart_id: string | null;
  public_path: string | null;
  graph: FlowchartData | null;
};
export type DeckResult = DeckSummary & {
  job_status: "queued" | "running" | "done" | "failed";
  error: string | null;
  pages: {
    status: "pending" | "done" | "failed";
    count?: number;
    error?: string;
  }[];
  items: DeckDiagram[];
};

export function validateDeckFile(file: File | null): string | null {
  if (!file) return "Choose a PDF slide deck.";
  if (!file.name.toLowerCase().endsWith(".pdf"))
    return "Export your slides as a PDF first.";
  if (file.size > 20 * 1024 * 1024) return "The PDF must be 20 MB or smaller.";
  if (file.size === 0) return "The selected file is empty.";
  return null;
}

/** Same deterministic descriptions as the existing editor, with no second AI call. */
export function describeDeckDiagram(graph: FlowchartData, title: string) {
  const description = autoDescribe("flowchart", graph, title);
  const sections = createEmptyLongDescriptionSections();
  for (const key of Object.keys(sections) as LongDescriptionSectionKey[]) {
    sections[key].text = description.sections[key];
  }
  return {
    short_alt: description.shortAlt,
    summary: buildLongDescriptionMarkdown(sections),
  };
}

export function deckLinksText(deck: DeckResult, origin: string): string {
  return deck.items
    .filter((item) => item.public_path)
    .map(
      (item) =>
        `Slide ${item.page_number} - ${item.title}: ${origin}${item.public_path}`,
    )
    .join("\n");
}
