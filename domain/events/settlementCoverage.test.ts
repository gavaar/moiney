import { expect, it } from "vitest";
import { historyOperationFromEvents, type SettlementCoverageEvent, type SettlementEvent } from "./index";

const before = { capacity: 4000, fed: 4000, spent: 7000, pendingFedAdjustment: 0 };
const after = { ...before, spent: 0, fed: -1000 };
const donorBefore = { capacity: 6000, fed: 6000, spent: 4000, pendingFedAdjustment: 0 };
const donorAfter = { ...donorBefore, spent: 6000 };
const source: SettlementEvent = { id: "source-event", operationId: "source-event", userId: "owner", pipeId: "source",
  occurredAt: 1, type: "settlement", name: "Source", icon: "pipe", cause: "manual", before, after,
  coverage: { amountCents: 2000, pipeId: "donor", name: "Donor", icon: "shield", before: donorBefore, after: donorAfter } };
const mirror: SettlementCoverageEvent = { ...source, id: "donor-event", type: "settlement_coverage", pipeId: "donor", name: "Donor", icon: "shield",
  before: donorBefore, after: donorAfter, coverage: { amountCents: 2000, pipeId: "source", name: "Source", icon: "pipe", before, after } };

it("requires a complete reciprocal coverage operation and resolves either entry order", () => {
  expect(historyOperationFromEvents([source, mirror])).toEqual({ canonicalEvent: source, counterpart: mirror });
  expect(historyOperationFromEvents([mirror, source])).toEqual({ canonicalEvent: source, counterpart: mirror });
  expect(() => historyOperationFromEvents([source])).toThrow();
  expect(() => historyOperationFromEvents([mirror])).toThrow();
});

it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid coverage cents %s even when both entries agree", amountCents => {
  expect(() => historyOperationFromEvents([
    { ...source, coverage: { ...source.coverage!, amountCents } },
    { ...mirror, coverage: { ...mirror.coverage, amountCents } },
  ])).toThrow();
});

it("rejects mismatched reciprocal balances, presentation, and donor funding transfers", () => {
  for (const invalid of [
    { ...mirror, before: { ...donorBefore, spent: 0 } },
    { ...mirror, coverage: { ...mirror.coverage, before: { ...before, spent: 0 } } },
    { ...mirror, name: "Other donor" },
    { ...mirror, icon: "wallet" },
    { ...mirror, after: { ...donorAfter, fed: 4000 }, coverage: { ...mirror.coverage } },
  ]) expect(() => historyOperationFromEvents([source, invalid])).toThrow();
});
