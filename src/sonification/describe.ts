// A written equivalent of the sonification, for readers who cannot hear it (Deaf, hard of
// hearing and deafblind readers, or anyone without sound). Built from the same spec the player
// uses, so it describes exactly what plays.

import type { ParsedDataset, SonificationConfig } from "../types/types";
import { buildErieSpecFromConfig } from "./erieClient";

type Row = Record<string, unknown> & { __index: number; __time: number };

const fmt = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 });

export function describeSonification(
  dataset: ParsedDataset | null,
  config: SonificationConfig
): string | null {
  const v = config.valueColumn;
  if (!dataset || !v) return null;
  let rows: Row[];
  try {
    const spec = buildErieSpecFromConfig(dataset, config) as { data: { values: Row[] } };
    rows = [...spec.data.values].sort((a, b) => a.__time - b.__time);
  } catch {
    return null;
  }
  if (!rows.length) return null;

  const value = (r: Row) => r[v] as number;
  const measure = config.yLabel?.trim() || v;
  const timeName = config.timeColumn ? config.xLabel?.trim() || config.timeColumn : null;
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
  const max = rows.reduce((a, b) => (value(b) > value(a) ? b : a));
  const min = rows.reduce((a, b) => (value(b) < value(a) ? b : a));
  const range = value(max) - value(min);

  const parts = [
    `You will hear ${n} short ${n === 1 ? "note" : "notes"} over about 5 seconds, one for each row, ${
      timeName ? `in order of ${timeName}` : "in row order"
    }.`,
    `Higher notes mean a higher ${measure}.`,
  ];
  if (n > 1 && range > 0) {
    parts.push(
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
  return parts.join(" ");
}
