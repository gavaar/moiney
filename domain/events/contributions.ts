import { validateTransactionAmount } from "../money/money";
import type { HistoryEvent } from "./types";

export type EventFinancialContribution = {
  incomeCents: number;
  grossSpendingCents: number;
  refundCents: number;
};

export function eventFinancialContribution(event: HistoryEvent): EventFinancialContribution {
  if (event.type !== "pipe_creation" && event.type !== "pipe_deletion") {
    validateTransactionAmount(event.value, event.type === "feed" ? "feed" : "transaction");
  }
  const spendingValue = event.type === "third_party_transaction" ||
    (event.type === "transaction" && event.targetPipeId === undefined)
    ? event.value
    : 0;
  return {
    incomeCents: event.type === "feed" ? event.value : 0,
    grossSpendingCents: spendingValue < 0 ? -spendingValue : 0,
    refundCents: spendingValue > 0 ? spendingValue : 0,
  };
}
