import { canonicalizeTransactionTitle } from "../transactions/identity";

export type MonthlySpendingSummary = {
  totalIncomeCents: number;
  grossSpendingCents: number;
  refundCents: number;
  spendingTransactionCount: number;
  refundTransactionCount: number;
  largestSpendingTransactionCents: number;
  nextLargestSpendingCents?: number[];
  largestSpendingTransactions?: { title: string; amountCents: number }[];
};

export type TitleSpending = { title: string; count: number; netSpendingCents: number };

export function monthlyTitleSpending(transactions: (SpendingTransaction & { title: string })[]): TitleSpending[] {
  const totals = new Map<string, TitleSpending>();
  for (const transaction of transactions) {
    if (transaction.kind !== "expense") continue;
    const title = canonicalizeTransactionTitle(transaction.title);
    const previous = totals.get(title);
    totals.set(title, {
      title,
      count: (previous?.count ?? 0) + 1,
      netSpendingCents: (previous?.netSpendingCents ?? 0) - transaction.value,
    });
  }
  return [...totals.values()];
}

export function mergeTitleSpending(...pages: TitleSpending[][]): TitleSpending[] {
  const totals = new Map<string, TitleSpending>();
  for (const page of pages) for (const entry of page) {
    const previous = totals.get(entry.title);
    totals.set(entry.title, {
      title: entry.title,
      count: (previous?.count ?? 0) + entry.count,
      netSpendingCents: (previous?.netSpendingCents ?? 0) + entry.netSpendingCents,
    });
  }
  return [...totals.values()];
}

export function mostRepeatedTransaction(totals: TitleSpending[]): TitleSpending | null {
  return totals.filter((entry) => entry.count >= 2).sort((a, b) =>
    b.count - a.count || b.netSpendingCents - a.netSpendingCents || a.title.localeCompare(b.title)
  )[0] ?? null;
}

export type PipeSpending = { pipeId: string; netSpendingCents: number };
export type MonthlyOffender = {
  pipeId: string;
  name: string;
  netSpendingCents: number;
  capacityCents: number;
  overageCents: number;
};

type SpendingPipe = { id: string; parentId?: string; name: string; capacity: number };

export function rankMonthlyOffenders(
  pipes: SpendingPipe[],
  spending: PipeSpending[],
): MonthlyOffender[] {
  const parents = new Set(pipes.map((pipe) => pipe.parentId));
  const totals = new Map<string, number>();
  for (const { pipeId, netSpendingCents } of spending) {
    totals.set(pipeId, (totals.get(pipeId) ?? 0) + netSpendingCents);
  }
  return pipes.flatMap((pipe) => {
    if (!pipe.parentId || parents.has(pipe.id)) return [];
    const netSpendingCents = totals.get(pipe.id) ?? 0;
    const capacityCents = Math.max(0, pipe.capacity);
    const overageCents = netSpendingCents - capacityCents;
    return overageCents > 0
      ? [{ pipeId: pipe.id, name: pipe.name, netSpendingCents, capacityCents, overageCents }]
      : [];
  }).sort((a, b) =>
    b.overageCents - a.overageCents ||
    b.netSpendingCents - a.netSpendingCents ||
    a.name.localeCompare(b.name) ||
    a.pipeId.localeCompare(b.pipeId)
  ).slice(0, 3);
}

export function monthlyPipeSpending(transactions: (SpendingTransaction & { from?: string; paidFrom?: string })[]): PipeSpending[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.kind !== "expense" || !transaction.from) continue;
    totals.set(transaction.from, (totals.get(transaction.from) ?? 0) - transaction.value);
  }
  return Array.from(totals, ([pipeId, netSpendingCents]) => ({ pipeId, netSpendingCents }));
}

export function mergePipeSpending(...pages: PipeSpending[][]): PipeSpending[] {
  const totals = new Map<string, number>();
  for (const page of pages) for (const { pipeId, netSpendingCents } of page) {
    totals.set(pipeId, (totals.get(pipeId) ?? 0) + netSpendingCents);
  }
  return Array.from(totals, ([pipeId, netSpendingCents]) => ({ pipeId, netSpendingCents }));
}

export function mergeMonthlySpending(a: MonthlySpendingSummary, b: MonthlySpendingSummary): MonthlySpendingSummary {
  const largest = [a.largestSpendingTransactionCents, ...(a.nextLargestSpendingCents ?? []),
    b.largestSpendingTransactionCents, ...(b.nextLargestSpendingCents ?? [])]
    .filter((amount) => amount > 0).sort((left, right) => right - left).slice(0, 3);
  return {
    totalIncomeCents: a.totalIncomeCents + b.totalIncomeCents,
    grossSpendingCents: a.grossSpendingCents + b.grossSpendingCents,
    refundCents: a.refundCents + b.refundCents,
    spendingTransactionCount: a.spendingTransactionCount + b.spendingTransactionCount,
    refundTransactionCount: a.refundTransactionCount + b.refundTransactionCount,
    largestSpendingTransactionCents: largest[0] ?? 0,
    nextLargestSpendingCents: largest.slice(1),
    ...(a.largestSpendingTransactions && b.largestSpendingTransactions ? {
      largestSpendingTransactions: [...a.largestSpendingTransactions, ...b.largestSpendingTransactions]
        .sort((left, right) => right.amountCents - left.amountCents || left.title.localeCompare(right.title))
        .slice(0, 3),
    } : {}),
  };
}

type SpendingTransaction = {
  kind: "feed" | "expense" | "transfer";
  value: number;
  title?: string;
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
        const largest = [summary.largestSpendingTransactionCents, ...(summary.nextLargestSpendingCents ?? []), amount]
          .filter((value) => value > 0).sort((a, b) => b - a).slice(0, 3);
        summary.largestSpendingTransactionCents = largest[0] ?? 0;
        summary.nextLargestSpendingCents = largest.slice(1);
        if (transaction.title && summary.largestSpendingTransactions) {
          summary.largestSpendingTransactions = [...summary.largestSpendingTransactions, {
            title: transaction.title, amountCents: amount,
          }].sort((left, right) => right.amountCents - left.amountCents || left.title.localeCompare(right.title)).slice(0, 3);
        }
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
      nextLargestSpendingCents: [],
      largestSpendingTransactions: [],
    },
  );
}
