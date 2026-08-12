import { describe, expect, it } from "vitest";
import { computeCronNextDate } from "./scheduling";

describe("computeCronNextDate", () => {
  it("uses the explicit clock for a daily schedule", () => {
    const starting = Date.UTC(2026, 5, 15, 12);
    const now = Date.UTC(2026, 5, 15, 13);

    expect(computeCronNextDate(starting, 1, "days", now)).toBe(
      Date.UTC(2026, 5, 16, 5),
    );
  });
});
