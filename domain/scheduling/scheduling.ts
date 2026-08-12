export type CronUnit = "days" | "months" | "years";

const CRON_ANCHOR_HOUR = 5;
const CRON_EXECUTION_DELAY = 60 * 60 * 1000;

export function computeElapsedIntervals(
  starting: number,
  interval: number,
  unit: CronUnit,
  now: number,
): number {
  const start = new Date(starting);

  if (unit === "days") {
    const anchor = Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
      CRON_ANCHOR_HOUR,
    );
    const step = interval * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((now - anchor) / step));
  }

  const nowDate = new Date(now);
  const elapsedMonths =
    (nowDate.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (nowDate.getUTCMonth() - start.getUTCMonth());
  const monthsPerStep = unit === "years" ? interval * 12 : interval;
  return Math.max(0, Math.floor(elapsedMonths / monthsPerStep));
}

type CronAnchor = { year: number; month: number; day: number };

function occurrenceAt(
  anchor: CronAnchor,
  monthsPerStep: number,
  k: number,
): number {
  const monthIndex = anchor.year * 12 + anchor.month + k * monthsPerStep;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  return Date.UTC(
    targetYear,
    targetMonth,
    Math.min(anchor.day, daysInTargetMonth),
    CRON_ANCHOR_HOUR,
  );
}

export function computeCronNextDate(
  starting: number,
  interval: number,
  unit: CronUnit,
  now: number,
): number {
  const start = new Date(starting);
  const anchor: CronAnchor = {
    year: start.getUTCFullYear(),
    month: start.getUTCMonth(),
    day: start.getUTCDate(),
  };
  const anchorTs = Date.UTC(
    anchor.year,
    anchor.month,
    anchor.day,
    CRON_ANCHOR_HOUR,
  );

  if (unit === "days") {
    const step = interval * 24 * 60 * 60 * 1000;
    const steps = Math.max(0, Math.floor((now - anchorTs) / step) + 1);
    return anchorTs + steps * step;
  }

  const monthsPerStep = unit === "years" ? interval * 12 : interval;
  const k = computeElapsedIntervals(starting, interval, unit, now);
  let next = occurrenceAt(anchor, monthsPerStep, k);
  if (next <= now) {
    next = occurrenceAt(anchor, monthsPerStep, k + 1);
  }
  return next;
}

export function computeCronIntervalProgress(
  cronNextDate: number,
  interval: number,
  unit: CronUnit,
  now: number,
): number {
  if (interval <= 0) return 0;

  const next = new Date(cronNextDate);
  const anchor: CronAnchor = {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth(),
    day: next.getUTCDate(),
  };

  const stepDuration =
    unit === "days"
      ? interval * 24 * 60 * 60 * 1000
      : cronNextDate -
        occurrenceAt(anchor, unit === "years" ? interval * 12 : interval, -1);

  const fullWindow = 24 * 60 * 60 * 1000;
  const fillSpan = stepDuration - fullWindow;
  if (fillSpan <= 0) return 1;

  const startOfInterval = cronNextDate - stepDuration + CRON_EXECUTION_DELAY;
  const elapsed = now - startOfInterval;
  if (elapsed < 0) return 0;

  const cycleElapsed = elapsed % stepDuration;
  return Math.min(1, cycleElapsed / fillSpan);
}
