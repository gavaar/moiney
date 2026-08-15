import { describe, expect, it } from "vitest";
import { countDueCronOccurrences, computeCronNextDate } from "./scheduling";

describe("computeCronNextDate", () => {
  it("uses the explicit clock for a daily schedule", () => {
    const starting = Date.UTC(2026, 5, 15, 12);
    const now = Date.UTC(2026, 5, 15, 13);

    expect(computeCronNextDate(starting, 1, "days", now)).toBe(
      Date.UTC(2026, 5, 16, 5),
    );
  });
});

describe("countDueCronOccurrences", () => {
  it("counts the current and missed daily occurrences", () => {
    expect(
      countDueCronOccurrences(
        Date.UTC(2026, 5, 13, 5),
        1,
        "days",
        Date.UTC(2026, 5, 15, 13),
      ),
    ).toBe(3);
  });

  it("returns zero when the next occurrence is in the future", () => {
    expect(
      countDueCronOccurrences(
        Date.UTC(2026, 5, 16, 5),
        1,
        "days",
        Date.UTC(2026, 5, 15, 13),
      ),
    ).toBe(0);
  });
});
