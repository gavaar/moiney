import { formatMoneyInput } from "@domain/money";
import type { PipeModel } from "@features/pipes/data/pipes";
import { safeIconName, type IconName } from "@ui/Icon";
import { createRuleDraft, type RuleDraft } from "@features/pipes/rules/rule-draft";
import { isFeedKind, type PipeKind } from "@features/pipes/rules/config";

export type PipeDraft = Omit<RuleDraft, "selectedRule"> & {
  kind: PipeKind | null;
  amount: string;
  contributed: string;
  ownerId: string | null;
  name: string;
  description: string;
  icon: IconName | "";
  priority: number;
  capacity: string;
  contingencyPipeId: string | null;
};

export function createPipeDraft(pipe?: PipeModel, ownerId: string | null = null): PipeDraft {
  const { selectedRule, ...options } = createRuleDraft(pipe);
  return {
    ...options,
    kind: pipe ? pipe.parentId ? selectedRule : pipe.sourceType === "boiler" ? "boiler" : "feed" : null,
    amount: "",
    contributed: "",
    ownerId: pipe?.parentId ?? ownerId,
    name: pipe?.name ?? "",
    description: pipe?.description ?? "",
    icon: pipe ? safeIconName(pipe.icon) : "pipe",
    priority: pipe?.priority ?? 0,
    capacity: pipe ? formatMoneyInput(pipe.capacity) : "",
    contingencyPipeId: pipe?.contingencyPipeId ?? null
  };
}

export function pipeRuleDraft(draft: PipeDraft): RuleDraft {
  return { ...draft, selectedRule: isFeedKind(draft.kind) ? "instant_settlement" : draft.kind ?? "none" };
}
