/** Inclusive UTC day counting, with fractional cents retained until display. */
export function monthlySpendingPace(spentCents: number, now: number) {
  const date = new Date(now);
  const elapsedDays = date.getUTCDate();
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const dailyAverageCents = spentCents / elapsedDays;
  const projectedCents = Math.round(spentCents + dailyAverageCents * (daysInMonth - elapsedDays));
  return { elapsedDays, dailyAverageCents, projectedCents };
}
