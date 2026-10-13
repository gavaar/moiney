import { describe, expect, it } from "vitest";
import { allocateContingencyCoverage, calculateContingencyCoverage } from "./contingencyCoverage";

describe("settlement-time contingency coverage", () => {
  it.each([
    { spent: 7000, capacity: 4000, fed: 6000, donorSpent: 4000, expected: 2000 },
    { spent: 0, capacity: -3000, fed: 5000, donorSpent: 1000, expected: 3000 },
    { spent: 100, capacity: -5000, fed: 8000, donorSpent: 1000, expected: 5100 },
    { spent: 4000, capacity: 4000, fed: 5000, donorSpent: 0, expected: 0 },
    { spent: 0, capacity: 4000, fed: 5000, donorSpent: 0, expected: 0 },
    { spent: 5000, capacity: 4000, fed: 1000, donorSpent: 2000, expected: 0 },
    { spent: 5000, capacity: 4000, fed: -100, donorSpent: 0, expected: 0 },
    { spent: 5000, capacity: 4000, fed: -100, donorSpent: -500, expected: 400 },
    { spent: -100, capacity: -500, fed: 1000, donorSpent: 0, expected: 400 },
  ])("covers $expected cents for source spent=$spent/capacity=$capacity and donor fed=$fed/spent=$donorSpent", row => {
    expect(calculateContingencyCoverage({ spent: row.spent, capacity: row.capacity },
      { fed: row.fed, spent: row.donorSpent })).toBe(row.expected);
  });

  it.each(["instant_settlement", "self_destruct"] as const)("does not create a claim for a %s source", rule => {
    expect(calculateContingencyCoverage({ capacity: -1000, spent: 3000, rule }, { fed: 8000, spent: 0 })).toBe(0);
  });

  it.each([0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects non-integer or unsafe balances (%s)", value => {
    expect(() => calculateContingencyCoverage({ capacity: 0, spent: value }, { fed: 1000, spent: 0 })).toThrow();
    expect(() => calculateContingencyCoverage({ capacity: value, spent: 1000 }, { fed: 1000, spent: 0 })).toThrow();
    expect(() => calculateContingencyCoverage({ capacity: 0, spent: 1000 }, { fed: value, spent: 0 })).toThrow();
    expect(() => calculateContingencyCoverage({ capacity: 0, spent: 1000 }, { fed: 1000, spent: value })).toThrow();
  });

  it("rejects unsafe derived differences without rejecting exact large balances", () => {
    expect(() => calculateContingencyCoverage({ capacity: -1, spent: Number.MAX_SAFE_INTEGER }, { fed: 1000, spent: 0 })).toThrow();
    expect(() => calculateContingencyCoverage({ capacity: 0, spent: 1000 }, { fed: Number.MAX_SAFE_INTEGER, spent: -1 })).toThrow();
    expect(calculateContingencyCoverage({ capacity: 0, spent: Number.MAX_SAFE_INTEGER },
      { fed: Number.MAX_SAFE_INTEGER, spent: 0 })).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("does not count pending external payment adjustments as donor liquidity", () => {
    const donor = { fed: 4000, spent: 3000, pendingFedAdjustment: 9000 };
    expect(calculateContingencyCoverage({ capacity: 4000, spent: 7000 }, donor)).toBe(1000);
  });
});

describe("one donor's same-occurrence, same-priority coverage claims", () => {
  const claim = (sourceId: string, demandCents: number) => ({ sourceId, capacity: 0, spent: demandCents });

  it("splits available funding equally with deterministic integer remainders", () => {
    const claims = [claim("c", 1000), claim("b", 1000), claim("a", 1000)];
    const donor = { fed: 1000, spent: 200 };
    const expected = [
      { sourceId: "a", coverageCents: 267 }, { sourceId: "b", coverageCents: 267 }, { sourceId: "c", coverageCents: 266 },
    ];
    expect(allocateContingencyCoverage(claims, donor)).toEqual(expected);
    expect(allocateContingencyCoverage([...claims].reverse(), donor)).toEqual(expected);
  });

  it("redistributes unused shares after capping small claims", () => {
    expect(allocateContingencyCoverage([claim("a", 100), claim("b", 1000), claim("c", 1000)], { fed: 1000, spent: 0 })).toEqual([
      { sourceId: "a", coverageCents: 100 }, { sourceId: "b", coverageCents: 450 }, { sourceId: "c", coverageCents: 450 },
    ]);
    expect(allocateContingencyCoverage([claim("a", 1), claim("b", 2), claim("c", 100)], { fed: 12, spent: 0 })).toEqual([
      { sourceId: "a", coverageCents: 1 }, { sourceId: "b", coverageCents: 2 }, { sourceId: "c", coverageCents: 9 },
    ]);
  });

  it("does not favor smaller uncapped demands when assigning an odd cent", () => {
    expect(allocateContingencyCoverage([claim("z", 300), claim("a", 1000)], { fed: 501, spent: 0 })).toEqual([
      { sourceId: "a", coverageCents: 251 }, { sourceId: "z", coverageCents: 250 },
    ]);
  });

  it("leaves unused donor liquidity intact and ignores zero or ineligible claims", () => {
    expect(allocateContingencyCoverage([
      claim("a", 100), claim("b", 200), claim("zero", 0),
      { ...claim("instant", 1000), rule: "instant_settlement" },
      { sourceId: "debt", capacity: -50, spent: 0 },
    ], { fed: 1000, spent: 0 })).toEqual([
      { sourceId: "a", coverageCents: 100 }, { sourceId: "b", coverageCents: 200 }, { sourceId: "debt", coverageCents: 50 },
    ]);
    expect(allocateContingencyCoverage([claim("a", 100)], { fed: 100, spent: 100 })).toEqual([]);
    expect(allocateContingencyCoverage([], { fed: 100, spent: 0 })).toEqual([]);
  });

  it("rejects duplicate sources even when the donor has no available funding", () => {
    for (const fed of [0, 1000]) {
      expect(() => allocateContingencyCoverage([claim("a", 100), claim("a", 200)], { fed, spent: 0 })).toThrow();
    }
  });

  it("validates every claim even when donor funding is exhausted", () => {
    expect(() => allocateContingencyCoverage([claim("a", 0.5)], { fed: 0, spent: 0 })).toThrow();
    expect(() => allocateContingencyCoverage([], { fed: Infinity, spent: 0 })).toThrow();
  });

  it("preserves funding bounds and capped fairness across small integer claim combinations", () => {
    for (const a of [0, 1, 2, 5]) for (const b of [0, 1, 2, 5]) for (const c of [0, 1, 2, 5]) {
      const demands = [a, b, c];
      const claims = demands.map((amount, index) => claim(String(index), amount));
      for (let budget = 0; budget <= 15; budget++) {
        const allocated = allocateContingencyCoverage(claims, { fed: budget + 7, spent: 7 });
        expect(allocated.reduce((sum, item) => sum + item.coverageCents, 0)).toBe(Math.min(budget, a + b + c));
        const byId = new Map(allocated.map(item => [item.sourceId, item.coverageCents]));
        const amounts = claims.map(item => byId.get(item.sourceId) ?? 0);
        amounts.forEach((amount, index) => {
          expect(Number.isSafeInteger(amount)).toBe(true);
          expect(amount).toBeGreaterThanOrEqual(0);
          expect(amount).toBeLessThanOrEqual(demands[index]);
        });
        const uncapped = amounts.filter((amount, index) => amount < demands[index]);
        if (uncapped.length > 0) expect(Math.max(...uncapped) - Math.min(...uncapped)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("does not mutate input balances and divides large safe budgets exactly", () => {
    const claims = Object.freeze([Object.freeze(claim("b", Number.MAX_SAFE_INTEGER)), Object.freeze(claim("a", Number.MAX_SAFE_INTEGER))]);
    const donor = Object.freeze({ fed: Number.MAX_SAFE_INTEGER, spent: 0 });
    expect(allocateContingencyCoverage(claims, donor)).toEqual([
      { sourceId: "a", coverageCents: 4503599627370496 }, { sourceId: "b", coverageCents: 4503599627370495 },
    ]);
  });
});
