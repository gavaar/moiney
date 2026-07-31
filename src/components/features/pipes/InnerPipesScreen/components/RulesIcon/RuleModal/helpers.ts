import { type Doc } from "@convex/_generated/dataModel";
import { type IconName } from "@ui/Icon";
import { type CronUnit } from "@convex/lib/pipes";
import { type RuleId } from "./config";

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
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export function hasRuleDiff(deps: {
  selectedRule: RuleId;
  isCron: boolean;
  capNumber: number | undefined;
  interval: number;
  unit: CronUnit;
  pipe?: Doc<"pipes">;
}): boolean {
  const { selectedRule, isCron, capNumber, interval, unit, pipe } = deps;
  const intendedRule = selectedRule === "none" ? undefined : selectedRule;
  if (intendedRule !== pipe?.rule) return true;
  if (isCron) {
    if (capNumber !== pipe?.capUpdateValue) return true;
    if (interval !== pipe?.cronInterval?.interval) return true;
    if (unit !== pipe?.cronInterval?.unit) return true;
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
  return (elapsedIntervals * (capNumber ?? 0)).toFixed(2);
}

export function shouldShowCapWarning(deps: {
  isCron: boolean;
  capNumber: number | undefined;
  elapsedIntervals: number;
}): boolean {
  const { isCron, capNumber, elapsedIntervals } = deps;
  return isCron && capNumber !== undefined && capNumber !== 0 && elapsedIntervals > 0;
}
