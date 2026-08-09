import { type IconName } from "@ui/Icon";

export type RuleId = "none" | "spend_overflow" | "any_spend" | "cron";

export type RuleOption = { id: RuleId; label: string; icon: IconName };

export const RULE_OPTIONS: readonly RuleOption[] = [
  { id: "none", label: "No rule", icon: "lock-open-outline" },
  { id: "any_spend", label: "Any spend", icon: "pipe-disconnected" },
  { id: "spend_overflow", label: "Spend overflow", icon: "pipe-leak" },
  { id: "cron", label: "Cron", icon: "timer-outline" },
];

export const RULE_DESCRIPTIONS: Record<RuleId, string> = {
  none: "No automatic rule. Manual runs will consume fed by spent amount, requiring new top-ups to refill capacity.",
  any_spend: "Reacts every time money is spent from this pipe and can update capacity.",
  spend_overflow: "Reacts when this pipe's spent amount reaches its capacity and can update capacity.",
  cron: "Reacts on a recurring schedule and can top up capacity.",
};

export const UNIT_OPTIONS = [
  { id: "days", label: "Day" },
  { id: "months", label: "Month" },
  { id: "years", label: "Year" },
] as const;
