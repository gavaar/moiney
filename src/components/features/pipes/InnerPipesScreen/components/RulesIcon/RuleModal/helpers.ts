import { type Doc } from "@convex/_generated/dataModel";
import { type IconName } from "@ui/Icon";
import { type CronUnit } from "@domain/scheduling";
import { type RuleId } from "./config";
import { divideMoney, formatMoneyInput, parseMoney } from "@domain/money";

export type Pacing = "months" | "years";

const MONTHLY_PACING_OPTION = { id: "months", label: "Monthly" } as const;
const YEARLY_PACING_OPTION = { id: "years", label: "Yearly" } as const;

export function getPacingOptions(unit: CronUnit) {
  if (unit === "months") return [MONTHLY_PACING_OPTION];
  if (unit === "years") return [MONTHLY_PACING_OPTION, YEARLY_PACING_OPTION];
  return [];
}

export function calculateEffectiveCron({
  capUpdateValue,
  interval,
  unit,
  pacing,
}: {
  capUpdateValue: number | undefined;
  interval: number;
  unit: CronUnit;
  pacing: Pacing | undefined;
}): {
  capUpdateValue: number | undefined;
  interval: number;
  unit: CronUnit;
  pacingDrift?: number;
} {
  if (capUpdateValue == null || capUpdateValue === 0 || pacing == null) {
    return { capUpdateValue, interval, unit };
  }

  const pacingPeriods =
    pacing === "months" && unit === "years"
      ? interval * 12
      : pacing === unit
        ? interval
        : undefined;

  if (pacingPeriods == null) return { capUpdateValue, interval, unit };

  const divided = divideMoney(capUpdateValue, pacingPeriods);
  return {
    capUpdateValue: divided.rounded,
    interval: 1,
    unit: pacing,
    ...(divided.drift !== 0 ? { pacingDrift: divided.drift } : {}),
  };
}

export function todayMidday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12),
  );
}

export function unitPlural(count: number, unit: CronUnit): string {
  const base = unit === "days" ? "day" : unit === "months" ? "month" : "year";
  return count === 1 ? base : `${base}s`;
}

export function parseCapValue(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  try {
    return parseMoney(value);
  } catch {
    return undefined;
  }
}

function utcDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function hasRuleDiff(deps: {
  selectedRule: RuleId;
  isCron: boolean;
  capNumber: number | undefined;
  interval: number;
  unit: CronUnit;
  starting?: number;
  pipe?: Doc<"pipes">;
}): boolean {
  const { selectedRule, isCron, capNumber, interval, unit, starting, pipe } = deps;
  const intendedRule = selectedRule === "none" ? undefined : selectedRule;
  if (intendedRule !== pipe?.rule) return true;
  if (isCron) {
    if (capNumber !== pipe?.capUpdateValue) return true;
    if (interval !== pipe?.cronInterval?.interval) return true;
    if (unit !== pipe?.cronInterval?.unit) return true;
    if (
      starting !== undefined &&
      (pipe?.cronNextDate === undefined ||
        utcDay(starting) !== utcDay(pipe.cronNextDate))
    ) {
      return true;
    }
  }
  if (
    !isCron &&
    (selectedRule === "instant_settlement" || selectedRule === "spend_overflow") &&
    capNumber !== pipe?.capUpdateValue
  ) {
    return true;
  }
  return false;
}

export function getActionConfig({ hasDiff, isCron }: { hasDiff: boolean; isCron: boolean }) {
  return {
    title: !hasDiff && !isCron ? "Run now" : "Save rule",
    variant: (!hasDiff && !isCron ? "secondary" : "primary") as "primary" | "secondary",
    icon: (!hasDiff && !isCron ? "water-outline" : undefined) as IconName | undefined,
    disabled: !hasDiff && isCron,
  };
}

export function formatCapCredit(
  elapsedIntervals: number,
  capNumber: number | undefined,
): string {
  return formatMoneyInput(elapsedIntervals * (capNumber ?? 0));
}

export function shouldShowCapWarning(deps: {
  isCron: boolean;
  capNumber: number | undefined;
  elapsedIntervals: number;
}): boolean {
  const { isCron, capNumber, elapsedIntervals } = deps;
  return isCron && capNumber !== undefined && capNumber !== 0 && elapsedIntervals > 0;
}
