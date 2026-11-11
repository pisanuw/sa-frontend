import type { DiagramType } from "./diagramTypes";
import { isDataStructure } from "./diagramTypes";

export type ViewId = "summary" | "alt" | "table" | "navigable" | "tactile" | "braille";

export type ViewOption = { value: ViewId; label: string };

const NAV_LABEL: Record<DiagramType, string> = {
  flowchart: "Navigable List",
  tree: "Navigable Tree",
  bt: "Navigable Tree",
  ll: "Navigable Linked List",
  arr: "Navigable Array",
  "2arr": "Navigable Grid",
};

/**
 * The representations offered for a diagram, best first (the first is the default).
 *
 * Where our renderers and Arboretum's both produce a view, the choice is by type:
 *  - Navigable and Table: Arboretum's for data structures (a real ARIA tree, parent/child
 *    and row/column headers); ours for flowcharts, which need arrow-by-arrow walking.
 *  - Tactile: Arboretum's braille-labelled shapes when every label is short enough to be
 *    printed in braille; otherwise ours (numbered shapes with a key), which handles long text.
 *  - Summary and Alt text are text, so the same for every type.
 *  - Braille is a .brf file of the text (and the tactile key), so also the same for every type.
 *
 * Data structures lead with the navigable view because the structure itself is the content;
 * flowcharts lead with the written summary because the long description carries the logic.
 */
export function viewsForType(type: DiagramType, brailleLabels: boolean): ViewOption[] {
  const tactile: ViewOption = {
    value: "tactile",
    label: isDataStructure(type) && brailleLabels ? "Tactile (braille labels)" : "Tactile",
  };
  const navigable: ViewOption = { value: "navigable", label: NAV_LABEL[type] };
  const table: ViewOption = { value: "table", label: "Table" };
  const summary: ViewOption = { value: "summary", label: "Summary" };
  const alt: ViewOption = { value: "alt", label: "Alt text" };
  const braille: ViewOption = { value: "braille", label: "Braille (.brf)" };

  return isDataStructure(type)
    ? [navigable, table, tactile, summary, alt, braille]
    : [summary, alt, table, navigable, tactile, braille];
}
