import { assertAmountLimit } from "../money";
import { computeCronNextDate, countDueCronOccurrences, type CronUnit } from "../scheduling";

export type PipeRule = "spend_overflow" | "instant_settlement" | "cron" | "self_destruct";
export type RuleConfiguration = {
  rule?: PipeRule | null;
  interval?: number;
  unit?: CronUnit;
  starting?: number;
  capUpdateValue?: number;
};
type RuleState = {
  capacity: number;
  rule?: PipeRule;
  capUpdateValue?: number;
  cronNextDate?: number;
  cronInterval?: { interval: number; unit: CronUnit };
};
export type PipeRulePatch = Partial<RuleState>;
export class RuleConfigurationError extends Error {}
const DAY_MS = 86400000;

export function selfDestructDeadline(date: number): number {
  const day = new Date(date);
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 5);
}

export function selfDestructProgress(deadline: number, intervalDays: number, now: number): number {
  const duration = Math.round(intervalDays * DAY_MS);
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - (deadline - now) / duration));
}

export function buildPipeRulePatch(pipe: RuleState, command: RuleConfiguration, now: number): PipeRulePatch | null {
  const patch: PipeRulePatch = {
    rule: command.rule ?? undefined,
    capUpdateValue: undefined,
    cronNextDate: undefined,
    cronInterval: undefined,
  };
  if (command.rule === "self_destruct") {
    const deadline = selfDestructDeadline(command.starting ?? NaN);
    if (!Number.isFinite(deadline) || deadline <= now) {
      throw new RuleConfigurationError("INVALID_SELF_DESTRUCT_DATE");
    }
    if (pipe.rule === "self_destruct" && pipe.cronNextDate === deadline) return null;
    return { ...patch, cronNextDate: deadline, cronInterval: { interval: (deadline - now) / DAY_MS, unit: "days" } };
  }
  if (command.rule != null && command.capUpdateValue !== undefined) {
    patch.capUpdateValue = assertAmountLimit(command.capUpdateValue);
  }
  if (command.rule !== "cron") return patch;
  if (command.interval === undefined || command.unit === undefined || command.starting === undefined) {
    throw new RuleConfigurationError("Cron rule requires interval, unit, and starting");
  }
  if (!Number.isSafeInteger(command.interval) || command.interval <= 0 || !Number.isFinite(new Date(command.starting).getTime())) {
    throw new RuleConfigurationError("INVALID_CRON_SCHEDULE");
  }
  if (pipe.rule === "cron" && pipe.cronNextDate !== undefined &&
    command.capUpdateValue === pipe.capUpdateValue && command.interval === pipe.cronInterval?.interval &&
    command.unit === pipe.cronInterval?.unit &&
    Math.floor(command.starting / DAY_MS) === Math.floor(pipe.cronNextDate / DAY_MS)) return null;
  patch.cronInterval = { interval: command.interval, unit: command.unit };
  patch.cronNextDate = computeCronNextDate(command.starting, command.interval, command.unit, now);
  if (patch.capUpdateValue !== undefined) {
    const first = computeCronNextDate(command.starting, command.interval, command.unit, command.starting - 1);
    const count = countDueCronOccurrences(first, command.interval, command.unit, now);
    patch.capacity = assertAmountLimit(pipe.capacity + count * patch.capUpdateValue);
  }
  return patch;
}
