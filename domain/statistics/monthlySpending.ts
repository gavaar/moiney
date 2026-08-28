export type MonthlySpendingSummary = {
  totalIncomeCents: number;
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

type FeedSnapshot = {
  parentId?: unknown;
  fed: number;
  spent: number;
  contributedFed?: number;
};

export function summarizeRootFeedSnapshot(pipes: FeedSnapshot[]) {
  return pipes.reduce(
    (summary, pipe) => {
      if (pipe.parentId !== undefined) return summary;
      summary.volumeCents += pipe.fed - pipe.spent;
      summary.producedCents += (pipe.contributedFed ?? pipe.fed) - pipe.spent;
      return summary;
    },
    { volumeCents: 0, producedCents: 0 },
  );
}

export function summarizeMonthlySpending(
  transactions: SpendingTransaction[],
): MonthlySpendingSummary {
  return transactions.reduce<MonthlySpendingSummary>(
    (summary, transaction) => {
      if (transaction.kind === "feed") {
        summary.totalIncomeCents += transaction.value;
        return summary;
      }
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
      totalIncomeCents: 0,
      grossSpendingCents: 0,
      refundCents: 0,
      spendingTransactionCount: 0,
      refundTransactionCount: 0,
      largestSpendingTransactionCents: 0,
    },
  );
}
