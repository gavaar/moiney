export type MonthlySpendingSummary = {
  grossSpendingCents: number;
  refundCents: number;
  spendingTransactionCount: number;
  refundTransactionCount: number;
  largestSpendingTransactionCents: number;
};

type SpendingTransaction = {
  kind: "feed" | "expense" | "transfer";
  value: number;
};

export function summarizeMonthlySpending(
  transactions: SpendingTransaction[],
): MonthlySpendingSummary {
  return transactions.reduce<MonthlySpendingSummary>(
    (summary, transaction) => {
      if (transaction.kind !== "expense") return summary;

      if (transaction.value < 0) {
        const amount = -transaction.value;
        summary.grossSpendingCents += amount;
        summary.spendingTransactionCount += 1;
        summary.largestSpendingTransactionCents = Math.max(
          summary.largestSpendingTransactionCents,
          amount,
        );
      } else {
        summary.refundCents += transaction.value;
        summary.refundTransactionCount += 1;
      }

      return summary;
    },
    {
      grossSpendingCents: 0,
      refundCents: 0,
      spendingTransactionCount: 0,
      refundTransactionCount: 0,
      largestSpendingTransactionCents: 0,
    },
  );
}
