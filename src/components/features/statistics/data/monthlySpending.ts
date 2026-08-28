export type MonthlySpendingStat = {
  periodStart: number;
  totalIncomeCents?: number;
  grossSpendingCents: number;
  refundCents: number;
  spendingTransactionCount: number;
  refundTransactionCount: number;
  largestSpendingTransactionCents: number;
  volumeCents?: number;
  producedCents?: number;
};

export function formatMonthYear(periodStart: number): string {
  return new Date(periodStart).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function netSpendingCents(stat: MonthlySpendingStat): number {
  return stat.grossSpendingCents - stat.refundCents;
}

export function averageSpendingCents(stat: MonthlySpendingStat): number {
  if (stat.spendingTransactionCount === 0) return 0;
  return Math.round(stat.grossSpendingCents / stat.spendingTransactionCount);
}
