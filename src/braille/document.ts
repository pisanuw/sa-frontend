// A STEM image as a braille document: title, transcriber's note, alt text, long description
// and (for flowcharts) the tactile graphic's key, laid out on braille pages.
//
// Layout follows the basic BANA Braille Formats conventions: centered title, cell-5 and
// cell-7 headings, paragraphs starting in cell 3 with runovers in cell 1, list items in
// cell 1 (deeper levels two cells further in) with runovers two cells further, and
// transcriber's notes in 7-5 between transcriber's note indicators.
//
// Math ($…$ in any of the text) is written in Nemeth Code between the opening Nemeth Code
// indicator and the Nemeth Code terminator, following BANA's guidance for Nemeth within UEB.

import { layoutPages, pagesToBrf, type BrailleBlock, type PageOptions } from "./brf";
import type { KeyEntry } from "./tactileKey";
import { translateUeb, CELL } from "./ueb";
import { splitMath } from "../math/segments";

const TN_OPEN = "⠈⠨⠣";
const TN_CLOSE = "⠈⠨⠜";
const NEMETH_OPEN = "⠸⠩";
const NEMETH_CLOSE = "⠸⠱";

export type BrailleDocumentInput = {
  title: string;
  altText?: string | null;
  /** Long description as Markdown. */
  longDescription?: string | null;
  /** Key of the tactile graphic, when there is one. */
  key?: KeyEntry[];
  /** Where the original lives, e.g. the shared page address. */
  source?: string | null;
  /**
   * Nemeth braille for each TeX expression in the text (see `src/braille/stemImage.ts`). Math
   * missing from the map, or mapped to null, is written as its LaTeX source.
   */
  math?: Map<string, string | null>;
};

export type BrailleDocument = {
  /** Pages of Unicode braille lines, for a preview. */
  pages: string[][];
  /** The .brf file contents. */
  brf: string;
  /** Characters that had no braille equivalent (shown as ⠿). */
  unknown: string[];
};

type Line =
  | { kind: "heading"; level: number; text: string }
  | { kind: "item"; level: number; text: string }
  | { kind: "paragraph"; text: string };

function stripMarks(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_]([^*_\s][^*_]*?)[*_](?=[^\w*]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1");
}

/**
 * Drop inline Markdown: emphasis, code marks, links and images keep only their text. Math is
 * left as written, since its `_` and `*` are TeX, not emphasis.
 */
export function stripInlineMarkdown(s: string): string {
  return splitMath(s, { skipCode: true })
    .map((seg) =>
      seg.kind === "math" ? (seg.display ? `$$${seg.tex}$$` : `$${seg.tex}$`) : stripMarks(seg.text)
    )
    .join("")
    .trim();
}

/** Headings, list items (with nesting) and paragraphs from Markdown. */
export function markdownLines(markdown: string): Line[] {
  const out: Line[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "paragraph", text: stripInlineMarkdown(para.join(" ")) });
    para = [];
  };
  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = raw.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    const item = raw.match(/^(\s*)(?:[-*+]|(\d+)[.)])\s+(.*)$/);
    if (!raw.trim()) flush();
    else if (heading) {
      flush();
      out.push({ kind: "heading", level: heading[1].length, text: stripInlineMarkdown(heading[2]) });
    } else if (item) {
      flush();
      const indent = item[1].replace(/\t/g, "  ").length;
      const text = (item[2] ? `${item[2]}. ` : "") + stripInlineMarkdown(item[3]);
      out.push({ kind: "item", level: Math.floor(indent / 2) + 1, text });
    } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(raw)) flush();
    else para.push(raw.trim());
  }
  flush();
  return out;
}

export function buildBrailleDocument(
  input: BrailleDocumentInput,
  options: PageOptions = {}
): BrailleDocument {
  const unknown = new Set<string>();
  let nemethUsed = false;
  let mathAsSource = false;
  const ueb = (s: string) => {
    const r = translateUeb(s);
    r.unknown.forEach((u) => unknown.add(u));
    return r.braille;
  };
  // Text in UEB; math in Nemeth between the switch indicators, or as LaTeX if not converted.
  const t = (s: string) =>
    splitMath(s)
      .map((seg) => {
        if (seg.kind === "text") return ueb(seg.text);
        const nemeth = input.math?.get(seg.tex);
        if (nemeth) {
          nemethUsed = true;
          // Blank cells inside the math become spaces, so lines can break there.
          return `${NEMETH_OPEN} ${nemeth.replace(/⠀/g, " ")} ${NEMETH_CLOSE}`;
        }
        mathAsSource = true;
        return ueb(seg.display ? `$$${seg.tex}$$` : `$${seg.tex}$`);
      })
      .join("");

  const blocks: BrailleBlock[] = [];
  const heading = (text: string, level = 2) => {
    blocks.push({ kind: "blank" });
    const cell = level <= 2 ? 4 : 6;
    blocks.push({ kind: "indented", text: t(text), first: cell, runover: cell, keepWithNext: true });
  };
  const paragraph = (text: string) =>
    blocks.push({ kind: "indented", text: t(text), first: 2, runover: 0 });

  const title = input.title.trim() || "STEM image";
  blocks.push({ kind: "centered", text: t(title) });
  blocks.push({ kind: "blank" });

  // The note is written after everything else is translated, so it can list unknown symbols.
  const noteIndex = blocks.length;

  if (input.altText?.trim()) {
    heading("Alt text");
    paragraph(input.altText.trim());
  }

  if (input.longDescription?.trim()) {
    heading("Long description");
    for (const line of markdownLines(input.longDescription)) {
      if (line.kind === "heading") heading(line.text, line.level + 1);
      else if (line.kind === "paragraph") paragraph(line.text);
      else {
        const first = 2 * (line.level - 1);
        blocks.push({ kind: "indented", text: t(line.text), first, runover: first + 2 });
      }
    }
  }

  if (input.key?.length) {
    heading("Tactile graphic key");
    const lettered = input.key.some((e) => e.kind === "edge");
    paragraph(
      "Numbers inside shapes are steps." +
        (lettered ? " Letters beside lines are line labels." : "") +
        " Short line labels are written on the line itself."
    );
    for (const e of input.key) {
      blocks.push({ kind: "indented", text: `${e.braille} ${t(e.label)}`, first: 0, runover: 2 });
    }
  }

  const note = [
    "This file is in uncontracted Unified English Braille. It was made automatically by STEM-Accessibility and has not been checked by a braille transcriber.",
    input.source ? `Source: ${input.source}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  let noteBraille = t(note);
  if (nemethUsed) {
    noteBraille += ` ${ueb("Math is in Nemeth Code:")} ${NEMETH_OPEN} ${ueb("starts it and")} ${NEMETH_CLOSE} ${ueb("ends it.")}`;
  }
  if (mathAsSource) {
    noteBraille += " " + ueb("Math that could not be converted is shown as LaTeX between dollar signs.");
  }
  if (unknown.size) {
    noteBraille += " " + t("The symbol") + " " + CELL.unknown + " " + t("marks a character that could not be shown in braille.");
  }
  blocks.splice(noteIndex, 0, {
    kind: "indented",
    text: `${TN_OPEN}${noteBraille}${TN_CLOSE}`,
    first: 6,
    runover: 4,
  });

  const pages = layoutPages(blocks, options);
  return { pages, brf: pagesToBrf(pages), unknown: [...unknown] };
}
