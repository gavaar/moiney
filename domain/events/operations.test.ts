import { describe, expect, it } from "vitest";
import { MAX_AMOUNT } from "../money/money";
import { historyOperationFromEvents, type FinancialEvent, type HistoryEvent } from "./index";

const base = {
  id: "operation",
  operationId: "operation",
  userId: "owner",
  pipeId: "budget",
  occurredAt: Date.UTC(2026, 9, 1),
};

describe("history operation identity", () => {
  const transfer = {
    ...base,
    type: "transfer",
    title: "savings",
    targetPipeId: "boiler",
    value: -2_000,
  } satisfies FinancialEvent;
  const mirror = {
    ...transfer,
    id: "mirror",
    pipeId: "boiler",
    targetPipeId: "budget",
    value: 2_000,
  } satisfies FinancialEvent;

  it("resolves a single-entry expense through its own operation ID", () => {
    const event: HistoryEvent = {
      ...base,
      type: "transaction",
      title: "groceries",
      value: -2_000,
    };

    expect(historyOperationFromEvents([event])).toEqual({ canonicalEvent: event });
  });

  it.each(["pipe_creation", "pipe_deletion"] as const)("resolves %s as its own non-financial operation", (type) => {
    const event: HistoryEvent = {
      ...base,
      type,
      name: "budget",
      icon: "wallet",
      pipeType: "pipe",
      ancestorIds: ["root"],
    };
    expect(historyOperationFromEvents([event])).toEqual({ canonicalEvent: event });
  });

  it("accepts a positive feed as a single-entry operation", () => {
    const event: HistoryEvent = { ...base, type: "feed", title: "salary", value: 10_000 };
    expect(historyOperationFromEvents([event])).toEqual({ canonicalEvent: event });
  });

  it.each([-2_000, 2_000])("preserves structural transfer direction at value %i regardless of entry order", (value) => {
    const canonicalEvent: FinancialEvent = {
      ...base,
      type: "transfer",
      title: "savings",
      targetPipeId: "boiler",
      value,
    };
    const counterpart: FinancialEvent = {
      ...canonicalEvent,
      id: "mirror",
      pipeId: "boiler",
      targetPipeId: "budget",
      value: -value,
    };

    expect(historyOperationFromEvents([canonicalEvent, counterpart])).toEqual({ canonicalEvent, counterpart });
    expect(historyOperationFromEvents([counterpart, canonicalEvent])).toEqual({ canonicalEvent, counterpart });
    expect(canonicalEvent.value + counterpart.value).toBe(0);
  });

  it.each([-2_000, 500])("uses the spender as the canonical external expense/refund at value %i", (value) => {
    const canonicalEvent: FinancialEvent = {
      ...base,
      type: "third_party_transaction",
      title: "groceries",
      targetPipeId: "bank",
      value,
    };
    const counterpart: FinancialEvent = {
      ...base,
      id: "mirror",
      type: "transaction",
      title: "groceries",
      pipeId: "bank",
      targetPipeId: "budget",
      value: -value,
    };

    expect(historyOperationFromEvents([counterpart, canonicalEvent])).toEqual({ canonicalEvent, counterpart });
  });

  it.each([-MAX_AMOUNT, MAX_AMOUNT])("accepts a transfer at the signed cents boundary %i", (value) => {
    const canonicalEvent = { ...transfer, value };
    const counterpart = { ...mirror, value: -value };
    expect(historyOperationFromEvents([canonicalEvent, counterpart])).toEqual({ canonicalEvent, counterpart });
  });

  describe("external-payment integrity", () => {
    const spender = {
      ...base,
      type: "third_party_transaction",
      title: "groceries",
      targetPipeId: "bank",
      value: -2_000,
    } satisfies FinancialEvent;
    const payer = {
      ...spender,
      id: "mirror",
      type: "transaction",
      pipeId: "bank",
      targetPipeId: "budget",
      value: 2_000,
    } satisfies FinancialEvent;

    it.each([
      { name: "missing payer", events: [spender] },
      { name: "payer without spender", events: [payer] },
      { name: "wrong counterpart type", events: [spender, { ...payer, type: "transfer" }] },
      { name: "payer as canonical entry", events: [{ ...spender, id: "mirror" }, { ...payer, id: "operation" }] },
      { name: "unrelated payer target", events: [spender, { ...payer, targetPipeId: "other" }] },
    ] satisfies { name: string; events: HistoryEvent[] }[])("rejects $name", ({ events }) => {
      expect(() => historyOperationFromEvents(events)).toThrow();
    });
  });

  it.each([
    { name: "empty operation", events: [] },
    { name: "missing transfer counterpart", events: [transfer] },
    { name: "counterpart without canonical entry", events: [mirror] },
    { name: "duplicate entry", events: [transfer, transfer] },
    { name: "extra entry", events: [transfer, mirror, { ...mirror, id: "third" }] },
    { name: "different operation", events: [transfer, { ...mirror, operationId: "other" }] },
    { name: "different owner", events: [transfer, { ...mirror, userId: "other" }] },
    { name: "different date", events: [transfer, { ...mirror, occurredAt: base.occurredAt + 1 }] },
    { name: "different title", events: [transfer, { ...mirror, title: "other" }] },
    { name: "non-opposite values", events: [transfer, { ...mirror, value: 1_000 }] },
    { name: "wrong local pipe", events: [transfer, { ...mirror, pipeId: "other" }] },
    { name: "wrong target pipe", events: [transfer, { ...mirror, targetPipeId: "other" }] },
    { name: "self-transfer", events: [{ ...transfer, targetPipeId: "budget" }, { ...mirror, pipeId: "budget" }] },
  ])("rejects $name rather than producing a writable operation", ({ events }) => {
    expect(() => historyOperationFromEvents(events)).toThrow();
    expect(() => historyOperationFromEvents([...events].reverse())).toThrow();
  });

  it.each([0, 0.5, MAX_AMOUNT + 1, Number.NaN])("rejects invalid cents %s even when transfer values mirror", (value) => {
    expect(() => historyOperationFromEvents([
      { ...transfer, value },
      { ...mirror, value: -value },
    ])).toThrow();
  });

  it.each([0, -100])("rejects a single-entry feed with value %i", (value) => {
    expect(() => historyOperationFromEvents([{
      ...base,
      type: "feed",
      title: "salary",
      value,
    }])).toThrow();
  });
});
