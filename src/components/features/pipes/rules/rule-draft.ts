import { formatMoneyInput, parseMoney } from "@domain/money";
import { selfDestructDeadline } from "@domain/pipes/rules";
import type { PipeModel } from "@features/pipes/data/pipes";
import { RULE_OPTIONS, UNIT_OPTIONS, type RuleId } from "./config";
import { buildRuleConfiguration, calculateEffectiveCron, getPacingOptions, parseCapValue, todayMidday } from "./helpers";

export type RuleDraft = {
  selectedRule: RuleId;
  capValue: string;
  interval: number;
  unit: string;
  pacing: string | null;
  starting: Date;
  deletionDate: Date | null;
};

export function createRuleDraft(pipe?: PipeModel): RuleDraft {
  return {
    selectedRule: pipe?.rule ?? "none",
    capValue: pipe?.capUpdateValue === undefined ? "" : formatMoneyInput(pipe.capUpdateValue),
    interval: pipe?.rule === "cron" ? pipe.cronInterval?.interval ?? 1 : 1,
    unit: pipe?.rule === "cron" ? pipe.cronInterval?.unit ?? "months" : "months",
    pacing: null,
    starting: pipe?.rule === "cron" && pipe.cronNextDate !== undefined ? new Date(pipe.cronNextDate) : todayMidday(),
    deletionDate: pipe?.rule === "self_destruct" && pipe.cronNextDate !== undefined ? new Date(pipe.cronNextDate) : null,
  };
}

export function mergeRuleDraft<T extends Omit<RuleDraft, "selectedRule">>(previous: T, next: Partial<T>): T {
  const merged = { ...previous, ...next };
  const unit = UNIT_OPTIONS.find((option) => option.id === merged.unit)?.id ?? "months";
  if (!getPacingOptions(unit).some((option) => option.id === merged.pacing)) merged.pacing = null;
  return merged;
}

export function ruleDraftValues(draft: RuleDraft) {
  const selectedRule = RULE_OPTIONS.find((option) => option.id === draft.selectedRule)?.id ?? "none";
  const unit = UNIT_OPTIONS.find((option) => option.id === draft.unit)?.id ?? "months";
  const pacing = draft.pacing === "months" || draft.pacing === "years" ? draft.pacing : undefined;
  const capNumber = parseCapValue(draft.capValue);
  return {
    selectedRule,
    capNumber,
    effectiveCron: calculateEffectiveCron({ capUpdateValue: capNumber, interval: draft.interval, unit, pacing }),
    starting: selectedRule === "self_destruct" ? draft.deletionDate?.getTime() ?? NaN : draft.starting.getTime(),
  };
}

export function ruleConfigurationFromDraft(draft: RuleDraft) {
  return buildRuleConfiguration(ruleDraftValues(draft));
}

export function validateCap(value: string) {
  if (!value.trim()) return undefined;
  try { parseMoney(value); return undefined; } catch { return "Enter a valid capacity update"; }
}

export function validateInterval(value: number) {
  return Number.isSafeInteger(value) && value > 0 ? undefined : "Enter a positive whole interval";
}

export function validateDeletionDate(value: Date | null, now: number) {
  const deadline = value ? selfDestructDeadline(value.getTime()) : NaN;
  return Number.isFinite(deadline) && deadline > now ? undefined : "Choose a future deletion date (05:00 UTC)";
}

export function validateRuleDraft(draft: RuleDraft, now: number): string | undefined {
  if (draft.selectedRule === "self_destruct") return validateDeletionDate(draft.deletionDate, now);
  if (draft.selectedRule === "none") return undefined;
  const capError = validateCap(draft.capValue);
  if (capError) return capError;
  if (draft.selectedRule === "cron") return validateInterval(draft.interval) ??
    (Number.isFinite(draft.starting.getTime()) ? undefined : "Choose a starting date");
  return undefined;
}
