// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateEffectiveCron,
  formatCapCredit,
  getActionConfig,
  getPacingOptions,
  hasRuleDiff,
  parseCapValue,
  shouldShowCapWarning,
  todayMidday,
  unitPlural,
} from "./helpers";

describe("calculateEffectiveCron", () => {
  it("paces a yearly cap update monthly", () => {
    expect(
      calculateEffectiveCron({
        capUpdateValue: 120000,
        interval: 1,
        unit: "years",
        pacing: "months",
      }),
    ).toEqual({ capUpdateValue: 10000, interval: 1, unit: "months" });
  });

  it("paces a multi-month cap update monthly", () => {
    expect(
      calculateEffectiveCron({
        capUpdateValue: 120000,
        interval: 6,
        unit: "months",
        pacing: "months",
      }),
    ).toEqual({ capUpdateValue: 20000, interval: 1, unit: "months" });
  });

  it("paces a multi-year cap update yearly", () => {
    expect(
      calculateEffectiveCron({
        capUpdateValue: 120000,
        interval: 2,
        unit: "years",
        pacing: "years",
      }),
    ).toEqual({ capUpdateValue: 60000, interval: 1, unit: "years" });
  });

  it("preserves the cron when pacing is empty", () => {
    expect(
      calculateEffectiveCron({
        capUpdateValue: 120000,
        interval: 1,
        unit: "years",
        pacing: undefined,
      }),
    ).toEqual({ capUpdateValue: 120000, interval: 1, unit: "years" });
  });

  it("does not calculate pacing without a cap update", () => {
    expect(
      calculateEffectiveCron({
        capUpdateValue: undefined,
        interval: 1,
        unit: "years",
        pacing: "months",
      }),
    ).toEqual({ capUpdateValue: undefined, interval: 1, unit: "years" });
  });

  it("rounds an indivisible cap update and reports the cumulative drift", () => {
    expect(
      calculateEffectiveCron({
        capUpdateValue: 100000,
        interval: 3,
        unit: "months",
        pacing: "months",
      }),
    ).toEqual({
      capUpdateValue: 33333,
      interval: 1,
      unit: "months",
      pacingDrift: -1,
    });
  });
});

describe("getPacingOptions", () => {
  it("offers only compatible pacing units", () => {
    expect(getPacingOptions("days")).toEqual([]);
    expect(getPacingOptions("months").map(({ id }) => id)).toEqual(["months"]);
    expect(getPacingOptions("years").map(({ id }) => id)).toEqual(["months", "years"]);
  });
});

describe("todayMidday", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today at UTC noon", () => {
    vi.setSystemTime(Date.UTC(2026, 5, 15, 7, 30));
    const result = todayMidday();
    expect(result.getTime()).toBe(Date.UTC(2026, 5, 15, 12));
  });
});

describe("unitPlural", () => {
  it("returns singular for one", () => {
    expect(unitPlural(1, "days")).toBe("day");
    expect(unitPlural(1, "months")).toBe("month");
    expect(unitPlural(1, "years")).toBe("year");
  });

  it("returns plural otherwise", () => {
    expect(unitPlural(2, "days")).toBe("days");
    expect(unitPlural(12, "months")).toBe("months");
    expect(unitPlural(0, "years")).toBe("years");
  });
});

describe("parseCapValue", () => {
  it("parses a numeric string", () => {
    expect(parseCapValue("100")).toBe(10000);
    expect(parseCapValue("12.5")).toBe(1250);
  });

  it("returns undefined for empty input", () => {
    expect(parseCapValue("")).toBeUndefined();
    expect(parseCapValue("  ")).toBeUndefined();
  });

  it("returns undefined for non-numeric input", () => {
    expect(parseCapValue("abc")).toBeUndefined();
  });
});

describe("hasRuleDiff", () => {
  const basePipe = {
    _id: "pipe-1",
    userId: "user-1",
    name: "Groceries",
    icon: "cart-outline",
  } as any;

  it("returns true when the rule changed", () => {
    expect(
      hasRuleDiff({
        selectedRule: "any_spend",
        isCron: false,
        capNumber: undefined,
        interval: 1,
        unit: "months",
        pipe: { ...basePipe, rule: "cron" },
      }),
    ).toBe(true);
  });

  it("returns false when nothing changed", () => {
    expect(
      hasRuleDiff({
        selectedRule: "any_spend",
        isCron: false,
        capNumber: undefined,
        interval: 1,
        unit: "months",
        pipe: { ...basePipe, rule: "any_spend" },
      }),
    ).toBe(false);
  });

  it("returns true when a cron field changed", () => {
    expect(
      hasRuleDiff({
        selectedRule: "cron",
        isCron: true,
        capNumber: 5000,
        interval: 2,
        unit: "months",
        pipe: {
          ...basePipe,
          rule: "cron",
          capUpdateValue: 5000,
          cronInterval: { interval: 1, unit: "months" },
        },
      }),
    ).toBe(true);
  });

  it("returns true when only the cron starting day changed", () => {
    expect(
      hasRuleDiff({
        selectedRule: "cron",
        isCron: true,
        capNumber: 5000,
        interval: 1,
        unit: "months",
        starting: Date.UTC(2026, 5, 16, 12),
        pipe: {
          ...basePipe,
          rule: "cron",
          capUpdateValue: 5000,
          cronInterval: { interval: 1, unit: "months" },
          cronNextDate: Date.UTC(2026, 5, 15, 5),
        },
      }),
    ).toBe(true);
  });

  it("ignores clock differences on the same cron starting day", () => {
    expect(
      hasRuleDiff({
        selectedRule: "cron",
        isCron: true,
        capNumber: 5000,
        interval: 1,
        unit: "months",
        starting: Date.UTC(2026, 5, 15, 12),
        pipe: {
          ...basePipe,
          rule: "cron",
          capUpdateValue: 5000,
          cronInterval: { interval: 1, unit: "months" },
          cronNextDate: Date.UTC(2026, 5, 15, 5),
        },
      }),
    ).toBe(false);
  });

  it("returns true when a spend rule's cap update changed", () => {
    expect(
      hasRuleDiff({
        selectedRule: "spend_overflow",
        isCron: false,
        capNumber: 7500,
        interval: 1,
        unit: "months",
        pipe: { ...basePipe, rule: "spend_overflow", capUpdateValue: 2500 },
      }),
    ).toBe(true);
  });

  it("treats a cron rule without stored options as a diff", () => {
    expect(
      hasRuleDiff({
        selectedRule: "cron",
        isCron: true,
        capNumber: undefined,
        interval: 1,
        unit: "months",
        pipe: basePipe,
      }),
    ).toBe(true);
  });
});

describe("getActionConfig", () => {
  it("returns Run now when unchanged and not cron", () => {
    expect(getActionConfig({ hasDiff: false, isCron: false })).toEqual({
      title: "Run now",
      variant: "secondary",
      icon: "water-outline",
      disabled: false,
    });
  });

  it("returns Save rule when there is a diff", () => {
    expect(getActionConfig({ hasDiff: true, isCron: true })).toEqual({
      title: "Save rule",
      variant: "primary",
      icon: undefined,
      disabled: false,
    });
  });

  it("disables the action when unchanged and cron", () => {
    expect(getActionConfig({ hasDiff: false, isCron: true })).toEqual({
      title: "Save rule",
      variant: "primary",
      icon: undefined,
      disabled: true,
    });
  });
});

describe("formatCapCredit", () => {
  it("formats the credited cap", () => {
    expect(formatCapCredit(3, 5000)).toBe("150.00");
    expect(formatCapCredit(0, 5000)).toBe("0.00");
    expect(formatCapCredit(2, undefined)).toBe("0.00");
  });
});

describe("shouldShowCapWarning", () => {
  it("shows only for cron with a non-zero cap and elapsed intervals", () => {
    expect(shouldShowCapWarning({ isCron: true, capNumber: 5000, elapsedIntervals: 2 })).toBe(
      true,
    );
    expect(shouldShowCapWarning({ isCron: false, capNumber: 5000, elapsedIntervals: 2 })).toBe(
      false,
    );
    expect(shouldShowCapWarning({ isCron: true, capNumber: 0, elapsedIntervals: 2 })).toBe(
      false,
    );
    expect(
      shouldShowCapWarning({ isCron: true, capNumber: undefined, elapsedIntervals: 2 }),
    ).toBe(false);
    expect(shouldShowCapWarning({ isCron: true, capNumber: 5000, elapsedIntervals: 0 })).toBe(
      false,
    );
  });
});
