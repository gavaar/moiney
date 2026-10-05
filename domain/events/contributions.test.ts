import { describe, expect, it } from "vitest";
import { MAX_AMOUNT } from "../money/money";
import { eventFinancialContribution, type FinancialEvent, type HistoryEvent } from "./index";

const base = {
  id: "entry",
  operationId: "entry",
  userId: "owner",
  pipeId: "root",
  occurredAt: Date.UTC(2026, 9, 1),
};

describe("event financial contributions", () => {
  it("counts a feed as income without looking up its pipe", () => {
    expect(eventFinancialContribution({
      ...base,
      type: "feed",
      title: "salary",
      value: 10_000,
    })).toEqual({ incomeCents: 10_000, grossSpendingCents: 0, refundCents: 0 });
  });

  it.each([
    { value: -2_000, grossSpendingCents: 2_000, refundCents: 0 },
    { value: 500, grossSpendingCents: 0, refundCents: 500 },
  ])("counts a root transaction of $value as spending/refund, not income", ({ value, grossSpendingCents, refundCents }) => {
    expect(eventFinancialContribution({
      ...base,
      type: "transaction",
      title: "groceries",
      value,
    })).toEqual({ incomeCents: 0, grossSpendingCents, refundCents });
  });

  it.each([
    { value: -2_000, grossSpendingCents: 2_000, refundCents: 0 },
    { value: 500, grossSpendingCents: 0, refundCents: 500 },
  ])("counts externally paid spending/refund of $value once against the spender", ({ value, grossSpendingCents, refundCents }) => {
    const spender: FinancialEvent = {
      ...base,
      type: "third_party_transaction",
      title: "groceries",
      pipeId: "budget",
      targetPipeId: "bank",
      value,
    };
    const payer: FinancialEvent = {
      ...base,
      id: "mirror",
      type: "transaction",
      title: "groceries",
      pipeId: "bank",
      targetPipeId: "budget",
      value: -value,
    };

    expect(eventFinancialContribution(spender)).toEqual({ incomeCents: 0, grossSpendingCents, refundCents });
    expect(eventFinancialContribution(payer)).toEqual({ incomeCents: 0, grossSpendingCents: 0, refundCents: 0 });
  });

  it.each([-2_000, 2_000])("excludes either transfer side of value %i from income and spending", (value) => {
    expect(eventFinancialContribution({
      ...base,
      type: "transfer",
      title: "savings",
      targetPipeId: "boiler",
      value,
    })).toEqual({ incomeCents: 0, grossSpendingCents: 0, refundCents: 0 });
  });

  it.each(["pipe_creation", "pipe_deletion"] as const)("excludes %s from financial totals", (type) => {
    const event: HistoryEvent = {
      ...base,
      type,
      name: "savings",
      icon: "wallet",
      pipeType: "boiler",
      ancestorIds: [],
    };
    expect(eventFinancialContribution(event)).toEqual({ incomeCents: 0, grossSpendingCents: 0, refundCents: 0 });
  });

  it.each([0, 0.5, MAX_AMOUNT + 1, Number.NaN])("rejects invalid transaction cents %s", (value) => {
    expect(() => eventFinancialContribution({
      ...base,
      type: "transaction",
      title: "groceries",
      value,
    })).toThrow();
  });

  it.each([0, -100])("rejects non-positive feed cents %i", (value) => {
    expect(() => eventFinancialContribution({
      ...base,
      type: "feed",
      title: "salary",
      value,
    })).toThrow();
  });
});
