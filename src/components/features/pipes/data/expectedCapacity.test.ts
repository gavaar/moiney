import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { expectedMonthlyCapacity } from "./expectedCapacity";

const now = Date.UTC(2026, 1, 15);
const pipeId = (value: string) => value as Id<"pipes">;

describe("expectedMonthlyCapacity", () => {
  it("falls back to the current capacity when no cap update exists", () => {
    expect(
      expectedMonthlyCapacity(
        { id: pipeId("leaf"), capacity: 1000 },
        new Map(),
        now,
      ),
    ).toBe(1000);
  });

  it.each([
    ["daily", { interval: 1, unit: "days" as const }, 2800],
    ["every two days", { interval: 2, unit: "days" as const }, 1400],
    ["every three months", { interval: 3, unit: "months" as const }, 3333],
    ["yearly", { interval: 1, unit: "years" as const }, 833],
  ])("normalizes a %s rule to a monthly value", (_label, cronInterval, expected) => {
    expect(
      expectedMonthlyCapacity(
        {
          id: pipeId(_label),
          capacity: 1000,
          capUpdateValue: _label === "daily" || _label === "every two days" ? 100 : 10000,
          rule: "cron",
          cronInterval,
        },
        new Map(),
        now,
      ),
    ).toBe(expected);
  });

  it("sums each child's normalized update or capacity", () => {
    expect(
      expectedMonthlyCapacity(
        { id: pipeId("parent"), capacity: 0 },
        new Map([
          [
            pipeId("parent"),
            [
              {
                id: pipeId("updated"),
                capacity: 750,
                capUpdateValue: 100,
                rule: "cron",
                cronInterval: { interval: 1, unit: "months" },
              },
              { id: pipeId("fallback"), capacity: 500 },
            ],
          ],
        ]),
        now,
      ),
    ).toBe(600);
  });

  it("sums descendant updates when an immediate child has children", () => {
    const parentId = "parent" as Id<"pipes">;
    const childId = "child" as Id<"pipes">;
    const leafId = "leaf" as Id<"pipes">;

    expect(
      expectedMonthlyCapacity(
        { id: parentId, capacity: 0 },
        new Map([
          [parentId, [{ id: childId, capacity: 36000 }]],
          [
            childId,
            [{ id: leafId, capacity: 36000, capUpdateValue: 12000 }],
          ],
        ]),
        now,
      ),
    ).toBe(12000);
  });
});
