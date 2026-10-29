import type { PipeRule } from "../pipes/rules";
import type { CronUnit } from "../scheduling";

type ExpectedPipe = {
  id: string;
  capacity: number;
  capUpdateValue?: number;
  rule?: PipeRule;
  cronInterval?: { interval: number; unit: CronUnit };
};

type ExpectedChildren = ReadonlyMap<string, readonly ExpectedPipe[]>;

function daysInMonth(now: number): number {
  const date = new Date(now);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

function normalizedLeafCapacity(pipe: ExpectedPipe, now: number): number {
  if (pipe.capUpdateValue === undefined) return pipe.capacity;
  if (pipe.rule !== "cron" || !pipe.cronInterval) {
    return pipe.capUpdateValue;
  }

  const { interval, unit } = pipe.cronInterval;
  if (interval <= 0) return pipe.capUpdateValue;

  const monthlyOccurrences =
    unit === "days"
      ? daysInMonth(now) / interval
      : unit === "months"
        ? 1 / interval
        : 1 / (interval * 12);

  return Math.round(pipe.capUpdateValue * monthlyOccurrences);
}

function normalizedCapacity(
  pipe: ExpectedPipe,
  childrenByParent: ExpectedChildren,
  now: number,
): number {
  const children = childrenByParent.get(pipe.id) ?? [];
  if (children.length === 0) return normalizedLeafCapacity(pipe, now);

  return children.reduce(
    (total, child) => total + normalizedCapacity(child, childrenByParent, now),
    0,
  );
}

export function expectedMonthlyCapacity(
  pipe: ExpectedPipe,
  childrenByParent: ExpectedChildren,
  now: number,
): number {
  return normalizedCapacity(pipe, childrenByParent, now);
}
