import { eventFinancialContribution, type HistoryEvent } from "../events";
import { monthlyPipeSpending, monthlyTitleSpending, summarizeMonthlySpending } from "./monthlySpending";

export function summarizeMonthlyEventSpending(events: readonly HistoryEvent[]) {
  const transactions: { kind: "feed" | "expense"; title: string; value: number; from?: string }[] = [];
  for (const event of events) {
    const contribution = eventFinancialContribution(event);
    if (event.type === "pipe_creation" || event.type === "pipe_deletion") continue;
    if (contribution.incomeCents > 0) {
      transactions.push({ kind: "feed", title: event.title, value: contribution.incomeCents });
    } else if (contribution.grossSpendingCents > 0 || contribution.refundCents > 0) {
      transactions.push({ kind: "expense", title: event.title, value: contribution.refundCents - contribution.grossSpendingCents, from: event.pipeId });
    }
  }
  return {
    summary: summarizeMonthlySpending(transactions),
    pipeSpending: monthlyPipeSpending(transactions),
    titleSpending: monthlyTitleSpending(transactions),
  };
}
