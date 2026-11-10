// Layout of a flowchart's tactile graphic, in millimetres on a letter-size page.
//
// Braille is drawn as dots at standard sign dimensions (NLS Specification 800 ranges):
// 1.5 mm dots, 2.5 mm between dots in a cell, 6.2 mm from cell to cell. Shapes are sized
// to hold their braille symbol, and lines stop short of the shapes they join so a finger
// can tell them apart.

import type { FlowchartData } from "../types/types";
import type { FlowchartKey } from "./tactileKey";
import { toUeb } from "./ueb";

export const BRAILLE_MM = { dot: 1.5, dotSpacing: 2.5, cellSpacing: 6.2, cellHeight: 6.5 } as const;

const LETTER = { short: 215.9, long: 279.4 };
const MARGIN = 12.7;
const TITLE_BAND = 14;
const SHAPE_PAD = 4;
const SHAPE_HEIGHT = 14;
const GAP = 3; // minimum clear space between shapes

export type TactileShapeKind = "rectangle" | "rounded" | "diamond" | "ellipse" | "parallelogram";

export type TactileShape = {
  id: string;
  kind: TactileShapeKind;
  cx: number;
  cy: number;
  w: number;
  h: number;
  braille: string;
};

export type TactileLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed: boolean;
  arrowStart: boolean;
  arrowEnd: boolean;
  /** Centre of the label's braille. */
  label: { cx: number; cy: number; braille: string } | null;
};

export type TactileScene = {
  width: number;
  height: number;
  title: string;
  shapes: TactileShape[];
  lines: TactileLine[];
  /** Pairs of shapes closer than the minimum gap at this page size. */
  overlaps: number;
};

/** Width in mm of a braille string drawn as dots. */
export const brailleWidth = (cells: number) =>
  cells > 0 ? (cells - 1) * BRAILLE_MM.cellSpacing + BRAILLE_MM.dotSpacing + BRAILLE_MM.dot : 0;

/** Dot centres for braille text whose first cell's top-left dot is at (x, y). */
export function brailleDots(braille: string, x: number, y: number): { cx: number; cy: number }[] {
  const dots: { cx: number; cy: number }[] = [];
  if (!braille) return dots;
  [...braille].forEach((ch, i) => {
    const mask = (ch.codePointAt(0) ?? 0x2800) - 0x2800;
    for (let d = 0; d < 6; d++) {
      if (!(mask & (1 << d))) continue;
      dots.push({
        cx: x + i * BRAILLE_MM.cellSpacing + (d >= 3 ? BRAILLE_MM.dotSpacing : 0),
        cy: y + (d % 3) * BRAILLE_MM.dotSpacing,
      });
    }
  });
  return dots;
}

function shapeKind(shape: string | undefined): TactileShapeKind {
  const s = (shape || "").toLowerCase();
  if (s.includes("diamond") || s.includes("rhombus")) return "diamond";
  if (s.includes("circle") || s.includes("ellipse") || s.includes("oval")) return "ellipse";
  if (s.includes("parallelogram")) return "parallelogram";
  if (s.includes("round") || s.includes("stadium") || s.includes("pill")) return "rounded";
  return "rectangle";
}

function shapeSize(kind: TactileShapeKind, cells: number): { w: number; h: number } {
  const text = brailleWidth(cells);
  switch (kind) {
    case "diamond":
      // The braille has to fit in the middle of the diamond, which is half its width and height.
      return { w: Math.max(24, 2 * (text + 3)), h: 2 * (BRAILLE_MM.cellHeight + 3) };
    case "ellipse":
      return { w: Math.max(18, text * 1.45 + SHAPE_PAD), h: SHAPE_HEIGHT + 2 };
    case "parallelogram":
      return { w: Math.max(20, text + 2 * SHAPE_PAD + 8), h: SHAPE_HEIGHT };
    default:
      return { w: Math.max(16, text + 2 * SHAPE_PAD), h: SHAPE_HEIGHT };
  }
}

/** Distance from a shape's centre to its outline along the unit vector (ux, uy). */
function toOutline(s: TactileShape, ux: number, uy: number): number {
  const a = s.w / 2;
  const b = s.h / 2;
  const ax = Math.abs(ux);
  const ay = Math.abs(uy);
  if (s.kind === "diamond") return 1 / (ax / a + ay / b);
  if (s.kind === "ellipse") return 1 / Math.sqrt((ux / a) ** 2 + (uy / b) ** 2);
  return Math.min(ax ? a / ax : Infinity, ay ? b / ay : Infinity);
}

function centre(n: FlowchartData["nodes"][number]): { x: number; y: number } {
  const [p, q] = n.coordinates ?? [[0, 0], [0, 0]];
  const a = p ?? [0, 0];
  const b = q ?? a;
  return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
}

function place(
  data: FlowchartData,
  key: FlowchartKey,
  pageW: number,
  pageH: number
): { shapes: TactileShape[]; scale: number } {
  const raw = data.nodes.map((n) => {
    const braille = key.nodes.get(n.id)?.braille ?? "";
    const kind = shapeKind(n.shape);
    return { n, kind, braille, ...shapeSize(kind, braille.length), c: centre(n) };
  });
  const maxW = Math.max(...raw.map((r) => r.w));
  const maxH = Math.max(...raw.map((r) => r.h));
  const xs = raw.map((r) => r.c.x);
  const ys = raw.map((r) => r.c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const rangeX = Math.max(...xs) - minX;
  const rangeY = Math.max(...ys) - minY;

  const availW = pageW - 2 * MARGIN - maxW;
  const availH = pageH - 2 * MARGIN - TITLE_BAND - maxH;
  const candidates = [rangeX > 0 ? availW / rangeX : Infinity, rangeY > 0 ? availH / rangeY : Infinity];
  const scale = Math.min(...candidates);
  const k = Number.isFinite(scale) ? scale : 0; // a single shape (or all in one spot) is centred
  const offX = MARGIN + maxW / 2 + (availW - rangeX * k) / 2;
  const offY = MARGIN + TITLE_BAND + maxH / 2 + (availH - rangeY * k) / 2;

  const shapes = raw.map((r) => ({
    id: r.n.id,
    kind: r.kind,
    w: r.w,
    h: r.h,
    braille: r.braille,
    cx: offX + (r.c.x - minX) * k,
    cy: offY + (r.c.y - minY) * k,
  }));
  return { shapes, scale: k };
}

/** Which ends carry an arrowhead, with the same rules as the editor (`normalizeArrowDirection`). */
function arrowEnds(e: FlowchartData["edges"][number]): { start: boolean; end: boolean } {
  const heads = e.arrowheads;
  if (Array.isArray(heads)) {
    if (heads.length === 0) return { start: false, end: false };
    if (heads.includes("start") || heads.includes("end")) {
      return { start: heads.includes("start"), end: heads.includes("end") };
    }
  }
  if (e.markerEnd?.type) return { start: false, end: /arrow/i.test(e.markerEnd.type) };
  return { start: false, end: true };
}

function countOverlaps(shapes: TactileShape[]): number {
  let n = 0;
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i];
      const b = shapes[j];
      if (
        Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 + GAP &&
        Math.abs(a.cy - b.cy) < (a.h + b.h) / 2 + GAP
      )
        n++;
    }
  }
  return n;
}

export function layoutTactileFlowchart(
  data: FlowchartData,
  key: FlowchartKey,
  title = ""
): TactileScene | null {
  if (!data.nodes.length) return null;

  // Portrait or landscape, whichever leaves fewer overlaps (then the larger drawing).
  const options = [
    { w: LETTER.short, h: LETTER.long },
    { w: LETTER.long, h: LETTER.short },
  ].map((page) => {
    const { shapes, scale } = place(data, key, page.w, page.h);
    return { page, shapes, scale, overlaps: countOverlaps(shapes) };
  });
  options.sort((a, b) => a.overlaps - b.overlaps || b.scale - a.scale);
  const { page, shapes, overlaps } = options[0];

  const byId = new Map(shapes.map((s) => [s.id, s]));
  const lines: TactileLine[] = [];
  for (const e of data.edges) {
    const a = byId.get(e.source);
    const b = byId.get(e.destination);
    if (!a || !b || a === b) continue;
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const len = Math.hypot(dx, dy);
    if (!len) continue;
    const ux = dx / len;
    const uy = dy / len;
    const start = toOutline(a, ux, uy) + 1.5;
    const end = toOutline(b, -ux, -uy) + 1.5;
    if (start + end >= len) continue;
    const x1 = a.cx + ux * start;
    const y1 = a.cy + uy * start;
    const x2 = b.cx - ux * end;
    const y2 = b.cy - uy * end;

    const text = e.label?.trim();
    const shown = text ? key.edgeLabels.get(text)?.braille ?? null : null;
    let label: TactileLine["label"] = null;
    if (shown) {
      // Beside the middle of the line, on the side its normal points to.
      const off = BRAILLE_MM.cellHeight / 2 + 4;
      const mx = (x1 + x2) / 2 + -uy * off;
      const my = (y1 + y2) / 2 + ux * off;
      label = { cx: mx, cy: my, braille: shown };
    }
    const ends = arrowEnds(e);
    lines.push({
      x1,
      y1,
      x2,
      y2,
      dashed: /dash|dot/i.test(e.type ?? ""),
      arrowStart: ends.start,
      arrowEnd: ends.end,
      label,
    });
  }

  const maxCells = Math.floor((page.w - 2 * MARGIN) / BRAILLE_MM.cellSpacing);
  return {
    width: page.w,
    height: page.h,
    title: toUeb(title.trim()).slice(0, maxCells),
    shapes,
    lines,
    overlaps,
  };
}

export const TACTILE_MARGIN = MARGIN;

/** Dot centres for braille centred on (cx, cy). */
export function centredBrailleDots(braille: string, cx: number, cy: number) {
  const span = (braille.length - 1) * BRAILLE_MM.cellSpacing + BRAILLE_MM.dotSpacing;
  return brailleDots(braille, cx - span / 2, cy - BRAILLE_MM.dotSpacing);
}
