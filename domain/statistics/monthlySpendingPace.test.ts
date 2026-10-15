import { expect, it } from "vitest";
import { monthlySpendingPace } from "./monthlySpendingPace";

it.each([
  { date: "2026-02-01T00:00:00Z", spent: 100, days: 1, average: 100, projected: 2800 },
  { date: "2024-02-01T00:00:00Z", spent: 100, days: 1, average: 100, projected: 2900 },
  { date: "2024-02-29T23:59:59Z", spent: 290, days: 29, average: 10, projected: 290 },
  { date: "2026-04-15T12:00:00Z", spent: 150, days: 15, average: 10, projected: 300 },
  { date: "2026-07-21T00:30:00+02:00", spent: 1, days: 20, average: 0.05, projected: 2 },
  { date: "2026-07-20T12:00:00Z", spent: -20000, days: 20, average: -1000, projected: -31000 },
  { date: "2026-07-20T12:00:00Z", spent: 0, days: 20, average: 0, projected: 0 },
])("projects $spent cents at $date using inclusive UTC days and final-cent rounding", ({ date, spent, days, average, projected }) => {
  expect(monthlySpendingPace(spent, Date.parse(date))).toEqual({
    elapsedDays: days,
    dailyAverageCents: average,
    projectedCents: projected,
  });
});
