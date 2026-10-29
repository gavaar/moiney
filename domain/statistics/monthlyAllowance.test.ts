import { expect, it } from "vitest";
import { monthlyAllowance } from "./monthlyAllowance";

it("retains fractional cents when calculating the day of recovery", () => {
  const result = monthlyAllowance(10, 1, Date.UTC(2026, 5, 1));
  expect(result.dailyExpected).toBeCloseTo(1 / 3);
  expect(result.accruedAllowance).toBeCloseTo(1 / 3);
  expect(result.accumulatedSpend).toBeCloseTo(-2 / 3);
  expect(result.recovery).toEqual({ status: "recovering", days: 3 });
});

it("does not round a fractional deficit away when deciding availability", () => {
  expect(monthlyAllowance(10, 1, Date.UTC(2026, 5, 2)).recovery)
    .toEqual({ status: "recovering", days: 2 });
});
