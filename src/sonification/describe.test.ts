import { describe, expect, it, vi } from "vitest";

vi.mock("erie-web", () => ({}));

import { DESCRIPTION_UNAVAILABLE, describeSonification } from "./describe";
import { buildErieSpecFromConfig } from "./erieClient";

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

  it("says when every note is the same, and returns null before there is data", () => {
    expect(
      describeSonification({ columns: ["v"], rows: [{ v: 3 }, { v: 3 }] }, { preset: "line", valueColumn: "v" })
    ).toContain("same pitch: 3");
    expect(describeSonification(null, { preset: "line", valueColumn: "v" })).toBeNull();
    expect(describeSonification({ columns: ["v"], rows: [] }, { preset: "line", valueColumn: null })).toBeNull();
  });

  it("leaves blank values out instead of playing them as 0, and says how many", () => {
    const d = describeSonification(
      {
        columns: ["year", "v"],
        rows: [
          { year: 2020, v: 3 },
          { year: 2021, v: null },
          { year: 2022, v: "" },
          { year: 2023, v: 5 },
        ],
      },
      { preset: "line", valueColumn: "v", timeColumn: "year" }
    )!;
    expect(d).toContain("2 short notes");
    expect(d).toContain("the lowest is 3 (year 2020)");
    expect(d).not.toMatch(/NaN|\b0 \(/);
    expect(d).toContain("2 rows without a number for v or year are left out.");
  });

  it("says 'one note' for a single row, without a pitch comparison or a length", () => {
    const d = describeSonification({ columns: ["v"], rows: [{ v: 7 }] }, { preset: "line", valueColumn: "v" })!;
    expect(d).toContain("Then you will hear one note: 7 (row 1).");
    expect(d).not.toMatch(/same pitch|Higher notes|seconds/);
  });

  it("takes the length from the spec the player uses", () => {
    const dataset = { columns: ["v"], rows: [{ v: 1 }, { v: 2 }] };
    const config = { preset: "line" as const, valueColumn: "v" };
    const seconds = buildErieSpecFromConfig(dataset, config).encoding.time.scale.length;
    expect(describeSonification(dataset, config)).toContain(`over about ${seconds} seconds`);
  });

  it("explains when nothing can be played, and falls back when the spec cannot be built", () => {
    expect(
      describeSonification({ columns: ["v", "w"], rows: [{ v: "n/a", w: 1 }] }, { preset: "line", valueColumn: "v" })
    ).toBe("There is nothing to play: no row has a number for v.");
    expect(
      describeSonification({ columns: ["v"], rows: undefined as never }, { preset: "line", valueColumn: "v" })
    ).toBe(DESCRIPTION_UNAVAILABLE);
  });
});

describe("buildErieSpecFromConfig", () => {
  it("does not play a blank cell as 0", () => {
    const spec = buildErieSpecFromConfig(
      { columns: ["v"], rows: [{ v: 4 }, { v: null }, { v: "  " }, { v: 6 }] },
      { preset: "line", valueColumn: "v" }
    );
    expect(spec.data.values.map((r) => r.v)).toEqual([4, 6]);
  });
});
