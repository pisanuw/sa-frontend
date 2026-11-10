import { describe, expect, it, vi } from "vitest";

vi.mock("erie-web", () => ({}));

import { describeSonification } from "./describe";

describe("describeSonification", () => {
  it("describes notes, range, start, end and direction", () => {
    const d = describeSonification(
      {
        columns: ["year", "sales"],
        rows: [
          { year: 2020, sales: 10 },
          { year: 2021, sales: 4 },
          { year: 2022, sales: 25 },
        ],
      },
      { preset: "line", valueColumn: "sales", timeColumn: "year" }
    )!;
    expect(d).toContain("3 short notes");
    expect(d).toContain("one for each row, in order of year");
    expect(d).toContain("Higher notes mean a higher sales.");
    expect(d).toContain("highest note is 25 (year 2022)");
    expect(d).toContain("lowest is 4 (year 2021)");
    expect(d).toContain("starts at 10 (year 2020) and ends at 25 (year 2022)");
    expect(d).toContain("Overall the notes rise.");
  });

  it("uses row order and category names, and the author's axis label", () => {
    const d = describeSonification(
      { columns: ["fruit", "n"], rows: [{ fruit: "Apples", n: 9 }, { fruit: "Pears", n: 2 }] },
      { preset: "bar", valueColumn: "n", categoryColumn: "fruit", yLabel: "count" }
    )!;
    expect(d).toContain("one for each row, in row order");
    expect(d).toContain("a higher count");
    expect(d).toContain("(Apples)");
    expect(d).toContain("Overall the notes fall.");
  });

  it("says when every note is the same, and returns null with nothing to play", () => {
    expect(
      describeSonification({ columns: ["v"], rows: [{ v: 3 }, { v: 3 }] }, { preset: "line", valueColumn: "v" })
    ).toContain("same pitch: 3");
    expect(describeSonification(null, { preset: "line", valueColumn: "v" })).toBeNull();
    expect(describeSonification({ columns: ["v"], rows: [] }, { preset: "line", valueColumn: "v" })).toBeNull();
  });
});
