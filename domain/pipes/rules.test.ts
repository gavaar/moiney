import { describe, expect, it } from "vitest";
import { buildPipeRulePatch, selfDestructProgress } from "./rules";

const now = Date.UTC(2026, 8, 20, 17);
const deadline = Date.UTC(2026, 8, 21, 5);

describe("pipe rule configuration", () => {
  it("normalizes deletion to 05:00 UTC and stores a fractional-day countdown", () => {
    const patch = buildPipeRulePatch({ capacity: 1000 }, { rule: "self_destruct", starting: Date.UTC(2026, 8, 21, 12) }, now);
    expect(patch).toMatchObject({ rule: "self_destruct", cronNextDate: deadline, cronInterval: { interval: 0.5, unit: "days" } });
    expect(selfDestructProgress(deadline, 0.5, now)).toBe(0);
    expect(selfDestructProgress(deadline, 0.5, now + 6 * 3600000)).toBe(0.5);
    expect(selfDestructProgress(deadline, 0.5, deadline + 1)).toBe(1);
  });
  it.each([undefined, NaN, Infinity, now, deadline - 86400000])("rejects nonfuture or invalid dates: %s", (starting) => {
    expect(() => buildPipeRulePatch({ capacity: 0 }, { rule: "self_destruct", starting }, now)).toThrow("INVALID_SELF_DESTRUCT_DATE");
  });
  it("preserves an unchanged countdown and restarts a changed deadline", () => {
    const pipe = { capacity: 0, rule: "self_destruct" as const, cronNextDate: deadline, cronInterval: { interval: 0.5, unit: "days" as const } };
    expect(buildPipeRulePatch(pipe, { rule: "self_destruct", starting: deadline }, now + 1000)).toBeNull();
    expect(buildPipeRulePatch(pipe, { rule: "self_destruct", starting: deadline + 86400000 }, now)).toMatchObject({ cronInterval: { interval: 1.5, unit: "days" } });
    expect(buildPipeRulePatch(pipe, {}, now)).toEqual({ rule: undefined, capUpdateValue: undefined, cronNextDate: undefined, cronInterval: undefined });
  });
});
