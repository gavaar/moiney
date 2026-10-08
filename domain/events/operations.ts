import { validateTransactionAmount } from "../money/money";
import type { FinancialEvent, HistoryEvent, HistoryOperation, PaymentTransactionEvent } from "./types";

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
    if (entry.type !== "pipe_creation" && entry.type !== "pipe_deletion") {
      validateTransactionAmount(entry.value, entry.type === "feed" ? "feed" : "transaction");
    }
  }
  const counterpart = events.find((entry) => entry.id !== event.id);
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
  return { canonicalEvent: event };
}
