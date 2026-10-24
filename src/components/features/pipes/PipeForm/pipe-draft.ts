import type { FunctionArgs } from "convex/server";
import type { api } from "@convex/_generated/api";
import { formatMoneyInput, parseMoney } from "@domain/money";
import type { PipeModel } from "@features/pipes/data/pipes";
import { safeIconName, type IconName } from "@ui/Icon";
import { createRuleDraft, mergeRuleDraft, ruleConfigurationFromDraft, ruleDraftValues, type RuleDraft } from "@features/pipes/rules/rule-draft";
import { hasRuleDiff } from "@features/pipes/rules/helpers";

export type PipeDraft = RuleDraft & {
  ownerId: string | null;
  name: string;
  description: string;
  icon: IconName | "";
  priority: number;
  capacity: string;
  contingencyPipeId: string | null;
};

const RULE_KEYS = ["selectedRule", "capValue", "interval", "unit", "pacing", "starting", "deletionDate"] as const;
const FIELD_KEYS = ["ownerId", "name", "description", "icon", "priority", "capacity", "contingencyPipeId"] as const;
function sameValue(left: unknown, right: unknown) {
  return left instanceof Date && right instanceof Date ? left.getTime() === right.getTime() : left === right;
}

export function createPipeDraft(pipe?: PipeModel, ownerId: string | null = null): PipeDraft {
  return {
    ...createRuleDraft(pipe),
    ownerId: pipe?.parentId ?? ownerId,
    name: pipe?.name ?? "",
    description: pipe?.description ?? "",
    icon: pipe ? safeIconName(pipe.icon) : "pipe",
    priority: pipe?.priority ?? 0,
    capacity: pipe ? formatMoneyInput(pipe.capacity) : "",
    contingencyPipeId: pipe?.contingencyPipeId ?? null
  };
}

export function ruleDisallowsContingency(rule: string) {
  return rule === "instant_settlement" || rule === "self_destruct";
}

/** Override only edited fields, including rule options; untouched schedules stay live. */
export function changePipeEdits(live: PipeDraft, edits: Partial<PipeDraft>, next: Partial<PipeDraft>): Partial<PipeDraft> {
  const current = { ...live, ...edits };
  const merged = mergeRuleDraft(current, next);
  const result = { ...edits };
  function record<K extends keyof PipeDraft>(key: K) {
    if (sameValue(merged[key], live[key])) delete result[key];
    else result[key] = merged[key];
  }
  for (const key of FIELD_KEYS) if (!sameValue(merged[key], current[key])) record(key);
  for (const key of RULE_KEYS) if (!sameValue(merged[key], current[key])) record(key);
  if (!isRuleDraftDirty(merged, live)) for (const key of RULE_KEYS) delete result[key];
  if (merged.selectedRule !== current.selectedRule && ruleDisallowsContingency(merged.selectedRule)) {
    result.contingencyPipeId = null;
  }
  return result;
}

export function hasPipeRuleChanges(draft: RuleDraft, pipe: PipeModel): boolean {
  const values = ruleDraftValues(draft);
  return hasRuleDiff({
    pipe,
    selectedRule: values.selectedRule,
    isCron: values.selectedRule === "cron",
    capNumber: values.effectiveCron.capUpdateValue,
    interval: values.effectiveCron.interval,
    unit: values.effectiveCron.unit,
    starting: values.starting
  });
}

export function isPipeDraftDirty(draft: PipeDraft, baseline: PipeDraft, leaf = true): boolean {
  const keys = leaf ? FIELD_KEYS : FIELD_KEYS.filter(key => key !== "capacity" && key !== "contingencyPipeId");
  if (keys.some(key => !sameValue(draft[key], baseline[key]))) return true;
  return leaf && isRuleDraftDirty(draft, baseline);
}

function isRuleDraftDirty(draft: RuleDraft, baseline: RuleDraft): boolean {
  const relevantRuleKeys = draft.selectedRule === "none" ? ["selectedRule"] as const
    : draft.selectedRule === "self_destruct" ? ["selectedRule", "deletionDate"] as const
      : draft.selectedRule === "cron" ? RULE_KEYS.filter(key => key !== "deletionDate")
        : ["selectedRule", "capValue"] as const;
  return relevantRuleKeys.some(key => !sameValue(draft[key], baseline[key]));
}

export function pipeUpdateFromDraft(pipe: PipeModel, draft: PipeDraft, pipes: readonly PipeModel[], leaf: boolean): FunctionArgs<typeof api.pipes.updatePipe> {
  const command: FunctionArgs<typeof api.pipes.updatePipe> = { pipeId: pipe.id };
  if (draft.name.trim() !== pipe.name) command.name = draft.name.trim();
  if ((draft.icon || "pipe") !== safeIconName(pipe.icon)) command.icon = draft.icon || "pipe";
  const description = draft.description.trim() ? draft.description : undefined;
  if (draft.description !== (pipe.description ?? "")) command.description = description ?? null;
  if (draft.priority !== pipe.priority) command.priority = draft.priority;
  if (!leaf) return command;
  const capacity = parseMoney(draft.capacity);
  if (capacity !== pipe.capacity) command.capacity = capacity;
  if (hasPipeRuleChanges(draft, pipe)) command.ruleConfig = ruleConfigurationFromDraft(draft);
  if (draft.contingencyPipeId !== (pipe.contingencyPipeId ?? null)) {
    command.contingencyPipeId = pipes.find(item => item.id === draft.contingencyPipeId)?.id ?? null;
  }
  return command;
}
