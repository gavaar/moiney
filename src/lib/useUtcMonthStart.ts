import { useEffect, useState } from "react";

function utcMonthStart(now: number) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

export function useUtcMonthStart(enabled: boolean) {
  const [periodStart, setPeriodStart] = useState(() => utcMonthStart(Date.now()));

  useEffect(() => {
    if (!enabled) return;
    const update = () => setPeriodStart(utcMonthStart(Date.now()));
    update();
    const nextMonth = new Date(periodStart);
    const deadline = Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 1);
    // A native timeout cannot span a whole 31-day month.
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (Date.now() >= deadline) update();
        else schedule();
      }, Math.min(Math.max(1, deadline - Date.now()), 24 * 60 * 60 * 1000));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled, periodStart]);

  return periodStart;
}
