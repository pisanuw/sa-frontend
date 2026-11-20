// A written equivalent of the sonification, for readers who cannot hear it (Deaf, hard of
// hearing and deafblind readers, or anyone without sound). Built from the same spec the player
// uses, so it describes exactly what plays: the notes, their order and the length of the stream.

import type { ParsedDataset, SonificationConfig } from "../types/types";
import { buildErieSpecFromConfig, countDataRows, NoPlayableRowsError } from "./erieClient";

type Row = Record<string, unknown> & { __index: number; __time: number };
type Spec = {
  data: { values: Row[] };
  encoding: { time: { scale: { length: number } } };
};

const fmt = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 });

/** Shown when the spec cannot be built for a reason other than missing numbers. */
export const DESCRIPTION_UNAVAILABLE = "A description of the sound isn’t available for this chart.";

/**
 * The sonification in words, or null when there is nothing to describe yet (no data or no
 * value column chosen).
 */
export function describeSonification(
  dataset: ParsedDataset | null,
  config: SonificationConfig
): string | null {
  const v = config.valueColumn;
  if (!dataset || !v) return null;
  const measure = config.yLabel?.trim() || v;
  const timeName = config.timeColumn ? config.xLabel?.trim() || config.timeColumn : null;
  const columns = timeName ? `${measure} or ${timeName}` : measure;

  let rows: Row[];
  let seconds: number;
  try {
    const spec = buildErieSpecFromConfig(dataset, config) as Spec;
    rows = [...spec.data.values].sort((a, b) => a.__time - b.__time);
    seconds = spec.encoding.time.scale.length;
  } catch (e) {
    return e instanceof NoPlayableRowsError
      ? `There is nothing to play: no row has a number for ${columns}.`
      : DESCRIPTION_UNAVAILABLE;
  }

  const value = (r: Row) => r[v] as number;
  const text = (raw: unknown) =>
    raw !== null && raw !== undefined && String(raw).trim() ? String(raw).trim() : null;
  // What a note stands for: its category, else its time value, else its row.
  const name = (r: Row) => {
    const category = config.categoryColumn ? text(r[config.categoryColumn]) : null;
    if (category) return category;
    const time = config.timeColumn ? text(r[config.timeColumn]) : null;
    if (time) return `${timeName} ${time}`;
    return `row ${r.__index + 1}`;
  };

  const n = rows.length;
  const first = rows[0];
  const last = rows[n - 1];
  // Erie reads a short introduction before the notes (how to stop, the title, what pitch means).
  const parts = ["A voice first reads the title and explains how the sound works."];

  if (n === 1) {
    parts.push(`Then you will hear one note: ${fmt.format(value(first))} (${name(first)}).`);
  } else {
    const max = rows.reduce((a, b) => (value(b) > value(a) ? b : a));
    const min = rows.reduce((a, b) => (value(b) < value(a) ? b : a));
    const range = value(max) - value(min);
    parts.push(
      `Then you will hear ${n} short notes over about ${fmt.format(seconds)} seconds, one for each row, ${
        timeName ? `in order of ${timeName}` : "in row order"
      }.`
    );
    if (range > 0) {
      parts.push(
        `Higher notes mean a higher ${measure}.`,
        `The highest note is ${fmt.format(value(max))} (${name(max)}) and the lowest is ${fmt.format(value(min))} (${name(min)}).`,
        `It starts at ${fmt.format(value(first))} (${name(first)}) and ends at ${fmt.format(value(last))} (${name(last)}).`
      );
      const change = value(last) - value(first);
      parts.push(
        Math.abs(change) <= 0.05 * range
          ? "It ends about where it started."
          : change > 0
            ? "Overall the notes rise."
            : "Overall the notes fall."
      );
    } else {
      parts.push(`Every note is the same pitch: ${fmt.format(value(first))}.`);
    }
  }

  const skipped = countDataRows(dataset) - n;
  if (skipped > 0) {
    parts.push(
      `${skipped === 1 ? "One row" : `${skipped} rows`} without a number for ${columns} ${
        skipped === 1 ? "is" : "are"
      } left out.`
    );
  }
  return parts.join(" ");
}
