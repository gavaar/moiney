import { describe, expect, it } from "vitest";
import { calculateSpentUpdate } from "./transactions";

describe("calculateSpentUpdate", () => {
  it("spent increases by -value when value is negative", () => {
    expect(calculateSpentUpdate(100, -30)).toBe(130);
  });

  it("spent decreases by value when value is positive", () => {
    expect(calculateSpentUpdate(100, 50)).toBe(50);
  });

  it("treats undefined currentSpent as 0", () => {
    expect(calculateSpentUpdate(undefined, -30)).toBe(30);
  });

  it("returns same spent when value is 0", () => {
    expect(calculateSpentUpdate(100, 0)).toBe(100);
  });
});
