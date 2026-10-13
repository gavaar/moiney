import { validateTransactionAmount } from "../money/money";
import type { FinancialEvent, HistoryEvent, HistoryOperation, PaymentTransactionEvent, SettlementBalance } from "./types";

function sameBalance(a: SettlementBalance, b: SettlementBalance): boolean {
  return (["capacity", "fed", "spent", "pendingFedAdjustment"] as const).every(field =>
    Number.isSafeInteger(a[field]) && a[field] === b[field]);
}

function isPaymentTransactionEvent<PipeId extends string, EventId extends string>(
  event: HistoryEvent<PipeId, EventId>,
): event is PaymentTransactionEvent<PipeId, EventId> {
  return event.type === "transaction" && event.targetPipeId !== undefined;
}

function assertMirroredEvents<PipeId extends string, EventId extends string>(
  event: FinancialEvent<PipeId, EventId> & { targetPipeId: PipeId },
  counterpart: FinancialEvent<PipeId, EventId> & { targetPipeId: PipeId },
): void {
  if (event.pipeId === event.targetPipeId ||
    counterpart.pipeId !== event.targetPipeId || counterpart.targetPipeId !== event.pipeId ||
    counterpart.title !== event.title || counterpart.value !== -event.value) {
    throw new Error("Invalid mirrored events");
  }
}

export function historyOperationFromEvents<PipeId extends string, EventId extends string>(
  events: readonly HistoryEvent<PipeId, EventId>[],
): HistoryOperation<PipeId, EventId> {
  if (events.length < 1 || events.length > 2) {
    throw new Error("An operation requires one or two entries");
  }
  const event = events.find((entry) => entry.id === entry.operationId);
  if (!event) {
    throw new Error("Invalid history operation");
  }
  if (events.some((entry) => entry.operationId !== event.operationId ||
    entry.userId !== event.userId || entry.occurredAt !== event.occurredAt)) {
    throw new Error("Inconsistent operation identity");
  }
  for (const entry of events) {
    if (entry.type !== "pipe_creation" && entry.type !== "pipe_deletion" && entry.type !== "settlement" && entry.type !== "settlement_coverage") {
      validateTransactionAmount(entry.value, entry.type === "feed" ? "feed" : "transaction");
    }
  }
  const counterpart = events.find((entry) => entry.id !== event.id);
  if (event.type === "settlement" && event.coverage) {
    const coverage = event.coverage;
    // Coverage aggregates debt and liquidity; it is not an individual transaction.
    if (!Number.isSafeInteger(coverage.amountCents) || coverage.amountCents <= 0) {
      throw new Error("Coverage requires positive safe integer cents");
    }
    if (counterpart?.type !== "settlement_coverage" || counterpart.pipeId !== event.coverage.pipeId ||
      counterpart.coverage.pipeId !== event.pipeId || counterpart.cause !== event.cause ||
      counterpart.coverage.amountCents !== coverage.amountCents || event.pipeId === counterpart.pipeId ||
      counterpart.name !== coverage.name || counterpart.icon !== coverage.icon ||
      counterpart.coverage.name !== event.name || counterpart.coverage.icon !== event.icon ||
      !sameBalance(counterpart.before, coverage.before) || !sameBalance(counterpart.after, coverage.after) ||
      !sameBalance(event.before, counterpart.coverage.before) || !sameBalance(event.after, counterpart.coverage.after) ||
      !sameBalance(coverage.after, { ...coverage.before, spent: coverage.before.spent + coverage.amountCents })) {
      throw new Error("Invalid settlement coverage counterpart");
    }
    return { canonicalEvent: { ...event, coverage: event.coverage }, counterpart };
  }
  if (event.type === "settlement_coverage") throw new Error("Coverage requires a canonical settlement");
  if (event.type === "transfer") {
    if (counterpart?.type !== "transfer") {
      throw new Error("Operation requires a transfer counterpart");
    }
    assertMirroredEvents(event, counterpart);
    return { canonicalEvent: event, counterpart };
  }
  if (event.type === "third_party_transaction") {
    if (!counterpart || !isPaymentTransactionEvent(counterpart)) {
      throw new Error("Operation requires a payment counterpart");
    }
    assertMirroredEvents(event, counterpart);
    return { canonicalEvent: event, counterpart };
  }
  if (events.length !== 1) {
    throw new Error("Invalid history operation");
  }
  if (isPaymentTransactionEvent(event)) {
    throw new Error("Operation requires a counterpart");
  }
  if (event.type === "settlement") {
    const { coverage: _coverage, ...settlement } = event;
    return { canonicalEvent: settlement };
  }
  return { canonicalEvent: event };
}
