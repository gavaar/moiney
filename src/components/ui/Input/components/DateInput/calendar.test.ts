import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildUtcNoon,
  getMonthGrid,
  getYearRange,
  monthLabel,
  yearRangeLabel,
} from "./calendar";

describe("getMonthGrid", () => {
  it("always returns 42 cells", () => {
    expect(getMonthGrid(2026, 6)).toHaveLength(42);
    expect(getMonthGrid(2026, 0)).toHaveLength(42);
  });

  it("builds July 2026 with 3 leading blanks (Wednesday start)", () => {
    const grid = getMonthGrid(2026, 6);
    expect(grid.slice(0, 3)).toEqual([null, null, null]);
    expect(grid[3]).toBe(1);
    expect(grid[33]).toBe(31);
    expect(grid.slice(34)).toEqual([null, null, null, null, null, null, null, null]);
  });

  it("handles a leap year February (2024, 29 days, Thursday start)", () => {
    const grid = getMonthGrid(2024, 1);
    expect(grid.slice(0, 4)).toEqual([null, null, null, null]);
    expect(grid[4]).toBe(1);
    expect(grid[32]).toBe(29);
    expect(grid.slice(33)).toEqual([null, null, null, null, null, null, null, null, null]);
  });
});

describe("addMonths", () => {
  it("increments within a year", () => {
    expect(addMonths({ year: 2026, month: 6 }, 1)).toEqual({ year: 2026, month: 7 });
  });

  it("wraps forward across year boundary", () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });

  it("wraps backward across year boundary", () => {
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("monthLabel", () => {
  it("formats month and year", () => {
    expect(monthLabel(2026, 6)).toBe("Jul 2026");
    expect(monthLabel(2026, 0)).toBe("Jan 2026");
  });
});

describe("getYearRange", () => {
  it("returns a 10-year window centered before the given year", () => {
    expect(getYearRange(2026)).toEqual([
      2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030,
    ]);
  });
});

describe("yearRangeLabel", () => {
  it("formats the first and last year of the window", () => {
    expect(yearRangeLabel(2026)).toBe("2021 - 2030");
  });
});

describe("buildUtcNoon", () => {
  it("builds a Date at UTC noon on the given day", () => {
    expect(buildUtcNoon(2026, 6, 21).getTime()).toBe(Date.UTC(2026, 6, 21, 12));
  });
});
