import { type IconName } from "@ui/Icon";
import type { PipeRule } from "@domain/pipes/rules";

export type RuleId = "none" | PipeRule;

export type RuleOption = { id: RuleId; label: string; icon: IconName };

export const RULE_OPTIONS: readonly RuleOption[] = [
  { id: "none", label: "No rule", icon: "lock-open-outline" },
  { id: "instant_settlement", label: "Instant settlement", icon: "pipe-disconnected" },
  { id: "spend_overflow", label: "Spend overflow", icon: "pipe-leak" },
  { id: "cron", label: "Cron", icon: "timer-outline" },
  { id: "self_destruct", label: "Self-destruct", icon: "bomb" },
];

export const RULE_DESCRIPTIONS: Record<RuleId, string> = {
  none: "No automatic rule. Manual runs will consume fed by spent amount, requiring new top-ups to refill capacity.",
  instant_settlement: "Settles this pipe whenever its spending changes and can update capacity.",
  spend_overflow: "Reacts when this pipe's spent amount reaches its capacity and can update capacity.",
  cron: "Reacts on a recurring schedule and can top up capacity.",
  self_destruct: "Tracks spending until its scheduled deletion at 05:00 UTC on the selected date. The pipe will then be automatically deleted, its remaining balance returned to its parent, and its transaction history preserved.",
};

export const UNIT_OPTIONS = [
  { id: "days", label: "Day" },
  { id: "months", label: "Month" },
  { id: "years", label: "Year" },
] as const;
