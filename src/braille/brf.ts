// Braille Ready Format (.brf): North American ASCII braille, laid out in pages.
//
// A .brf file can be sent to an embosser, opened on a braille notetaker, or read on a
// refreshable braille display through most braille apps. Each character stands for one cell.

import { brailleNumber } from "./ueb";

/** ASCII braille for the 64 six-dot cells, indexed by dot pattern (dot 1 = bit 0 … dot 6 = bit 5). */
const ASCII_BRAILLE = " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=";

/** Unicode braille → ASCII braille. Spaces and newlines pass through; dots 7 and 8 are dropped. */
export function unicodeToAsciiBraille(braille: string): string {
  let out = "";
  for (const ch of braille) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x2800 && code <= 0x28ff) out += ASCII_BRAILLE[(code - 0x2800) & 0x3f];
    else if (ch === "\n" || ch === " ") out += ch;
    else out += " ";
  }
  return out;
}

/** One block of the document, already translated to Unicode braille. */
export type BrailleBlock =
  | { kind: "centered"; text: string }
  /**
   * Paragraph: first line indented to `first` (0-based cell), runovers at `runover`. With
   * `keepWithNext` (headings) it moves to the next page rather than end a page on its own.
   */
  | { kind: "indented"; text: string; first: number; runover: number; keepWithNext?: boolean }
  | { kind: "blank" }
  | { kind: "pageBreak" };

export type PageOptions = {
  cellsPerLine?: number;
  linesPerPage?: number;
  /** Braille page number at the right margin of each page's first line. */
  pageNumbers?: boolean;
};

const DEFAULTS = { cellsPerLine: 40, linesPerPage: 25, pageNumbers: true };

/** Break text into lines no wider than `width`, never splitting a word that fits on a line. */
function wrap(text: string, firstWidth: number, restWidth: number): string[] {
  const words = text.split(/ +/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const width = () => (lines.length === 0 ? firstWidth : restWidth);
  for (let word of words) {
    if (!line && word.length <= width()) {
      line = word;
      continue;
    }
    if (line && line.length + 1 + word.length <= width()) {
      line += " " + word;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    // A word longer than a whole line is divided, hyphen-free, across lines.
    while (word.length > width()) {
      lines.push(word.slice(0, width()));
      word = word.slice(width());
    }
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Lay blocks out on braille pages. Returns pages of lines (Unicode braille), so callers can show
 * a preview or turn them into a file with `pagesToBrf`.
 */
export function layoutPages(blocks: BrailleBlock[], options: PageOptions = {}): string[][] {
  const { cellsPerLine, linesPerPage, pageNumbers } = { ...DEFAULTS, ...options };
  // With page numbers, line 1 of every page holds only the number, at the right margin.
  const textLines = pageNumbers ? linesPerPage - 1 : linesPerPage;
  const pages: string[][] = [[]];
  const current = () => pages[pages.length - 1];
  const newPage = () => pages.push([]);

  const pushLine = (line: string) => {
    if (current().length >= textLines) newPage();
    // No blank line at the top of a page.
    if (!line.trim() && current().length === 0) return;
    current().push(line);
  };

  for (const block of blocks) {
    if (block.kind === "pageBreak") {
      if (current().length) newPage();
      continue;
    }
    if (block.kind === "blank") {
      pushLine("");
      continue;
    }
    for (const paragraph of block.text.split("\n")) {
      if (block.kind === "centered") {
        for (const l of wrap(paragraph, cellsPerLine - 6, cellsPerLine - 6)) {
          const pad = Math.floor((cellsPerLine - l.length) / 2);
          pushLine(" ".repeat(pad) + l);
        }
      } else {
        const lines = wrap(paragraph, cellsPerLine - block.first, cellsPerLine - block.runover);
        if (block.keepWithNext && current().length && current().length + lines.length + 1 > textLines) {
          newPage();
        }
        lines.forEach((l, i) => pushLine(" ".repeat(i === 0 ? block.first : block.runover) + l));
      }
    }
  }

  const filled = pages.filter((p) => p.some((l) => l.trim()));
  if (!pageNumbers) return filled;
  return filled.map((page, i) => {
    const num = brailleNumber(i + 1);
    return [" ".repeat(cellsPerLine - num.length) + num, ...page];
  });
}

/** Pages → .brf text: CR LF line ends and a form feed between pages. */
export function pagesToBrf(pages: string[][]): string {
  return (
    pages.map((lines) => lines.map((l) => unicodeToAsciiBraille(l).trimEnd()).join("\r\n")).join("\r\n\f") +
    "\r\n"
  );
}
