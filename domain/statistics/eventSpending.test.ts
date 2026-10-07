import { describe, expect, it } from "vitest";
import type { HistoryEvent } from "../events";
import { summarizeMonthlyEventSpending } from "./eventSpending";
import { mergeMonthlySpending, mergePipeSpending, mergeTitleSpending, mostRepeatedTransaction } from "./monthlySpending";

function expense(id: string, value: number): Extract<HistoryEvent, { type: "transaction"; targetPipeId?: undefined }> {
  return { id, operationId: id, userId: "user", pipeId: "source", occurredAt: 1000, type: "transaction", title: "lunch", value };
}

describe("monthly event reporting", () => {
  it("counts logical spending/refunds and income once, never payer or transfer counterparts", () => {
    const base = { userId: "user", occurredAt: 1000, title: "lunch" };
    const result = summarizeMonthlyEventSpending([
      expense("ordinary", -100), expense("refund", 20),
      { ...base, id: "external", operationId: "external", pipeId: "source", targetPipeId: "payer", type: "third_party_transaction", value: -200 },
      { ...base, id: "payment", operationId: "external", pipeId: "payer", targetPipeId: "source", type: "transaction", value: 200 },
      { ...base, id: "external-refund", operationId: "external-refund", pipeId: "source", targetPipeId: "payer", type: "third_party_transaction", value: 30 },
      { ...base, id: "payment-refund", operationId: "external-refund", pipeId: "payer", targetPipeId: "source", type: "transaction", value: -30 },
      { ...base, id: "feed", operationId: "feed", pipeId: "payer", type: "feed", value: 1000 },
      { ...base, id: "transfer", operationId: "transfer", pipeId: "source", targetPipeId: "payer", type: "transfer", value: -500 },
      { ...base, id: "transfer-mirror", operationId: "transfer", pipeId: "payer", targetPipeId: "source", type: "transfer", value: 500 },
      { id: "created", operationId: "created", userId: "user", pipeId: "source", occurredAt: 1000, type: "pipe_creation", name: "Source", icon: "wallet", pipeType: "pipe", ancestorIds: [] },
    ]);
    expect(result.summary).toEqual({ totalIncomeCents: 1000, grossSpendingCents: 300, refundCents: 50, spendingTransactionCount: 2, refundTransactionCount: 2, largestSpendingTransactionCents: 200, nextLargestSpendingCents: [100], largestSpendingTransactions: [{ title: "lunch", amountCents: 200 }, { title: "lunch", amountCents: 100 }] });
    expect(result.pipeSpending).toEqual([{ pipeId: "source", netSpendingCents: 250 }]);
    expect(result.titleSpending).toEqual([{ title: "lunch", count: 4, netSpendingCents: 250 }]);
  });

  it("merges partial pages without resolving mirrors or counting payment-only pages", () => {
    const base = { userId: "user", occurredAt: 1000, title: "coffee" };
    const first = summarizeMonthlyEventSpending([{ ...base, id: "payment", operationId: "logical", pipeId: "payer", targetPipeId: "source", type: "transaction", value: 900 }]);
    const second = summarizeMonthlyEventSpending([
      { ...base, id: "logical", operationId: "logical", pipeId: "source", targetPipeId: "payer", type: "third_party_transaction", value: -900 },
      { ...expense("second", -900), title: " coffee " },
      { ...expense("refund", 100), title: "COFFEE" },
    ]);
    expect(first.pipeSpending).toEqual([]);
    expect(first.titleSpending).toEqual([]);
    expect(mergeMonthlySpending(first.summary, second.summary)).toMatchObject({ grossSpendingCents: 1800, refundCents: 100, spendingTransactionCount: 2, refundTransactionCount: 1, largestSpendingTransactionCents: 900, nextLargestSpendingCents: [900] });
    expect(mergePipeSpending(first.pipeSpending, second.pipeSpending)).toEqual([{ pipeId: "source", netSpendingCents: 1700 }]);
    expect(mostRepeatedTransaction(mergeTitleSpending(first.titleSpending, second.titleSpending))).toEqual({ title: "coffee", count: 3, netSpendingCents: 1700 });
  });
});
