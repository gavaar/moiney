/** Inclusive UTC allowance; retain fractional cents until presentation. */
export function monthlyAllowance(expectedCents: number, spentCents: number, now: number) {
  const date = new Date(now);
  const currentDay = date.getUTCDate();
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const dailyExpected = daysInMonth > 0 ? expectedCents / daysInMonth : 0;
  const accruedAllowance = dailyExpected * currentDay;
  const accumulatedSpend = accruedAllowance - spentCents;
  const daysUntilPositive = accumulatedSpend < 0 && dailyExpected > 0
    ? Math.floor(-accumulatedSpend / dailyExpected) + 1
    : null;
  return {
    dailyExpected,
    accruedAllowance,
    accumulatedSpend,
    recovery: accumulatedSpend >= 0
      ? { status: "available" as const }
      : daysUntilPositive !== null && daysUntilPositive <= daysInMonth - currentDay
        ? { status: "recovering" as const, days: daysUntilPositive }
        : { status: "exhausted" as const },
  };
}
