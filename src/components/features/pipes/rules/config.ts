import type { IconName } from "@ui/Icon";
import type { PipeRule } from "@domain/pipes/rules";
import { colors } from "@/lib/styles";

export type RuleId = "none" | PipeRule;
export type PipeKind = "feed" | "boiler" | RuleId;

type PipeChoice = {
  title: string;
  icon: IconName;
  color: string;
  description: string;
  shortDescription: string;
} & (
  | { id: "feed" | "boiler"; group: "feeds" }
  | { id: RuleId; group: "inner" }
);

export const PIPE_KINDS = {
  feed: {
    id: "feed",
    group: "feeds",
    title: "Basic feed",
    icon: "feed-pipe",
    color: colors.primaryMuted,
    description: `A source for money entering your system.
While it has no children it will settle instantly.
Think of places where you hold money: a bank account, paypal or cash in your wallet.`,
    shortDescription: "Bring money into your system",
  },
  boiler: {
    id: "boiler",
    group: "feeds",
    title: "Boiler",
    icon: "boiler",
    color: colors.secondarySoft,
    description: `Contributions grow. This allows to track contributions and held value separately.
While it has no children it will settle instantly.
Think of investment portfolios, bitcoin, or a savings account.`,
    shortDescription: "Track current value and contributions separately",
  },
  none: {
    id: "none",
    group: "inner",
    title: "Manual",
    icon: "valve",
    color: colors.text,
    description: `Accumulate spending. It can accumulate beyond its capacity, but will not settle until you choose to do so.
Useful when you want to have control over when the budget resets.`,
    shortDescription: "Accumulate spending; settle when you choose.",
  },
  instant_settlement: {
    id: "instant_settlement",
    group: "inner",
    title: "Instant",
    icon: "instant-pipe",
    color: colors.accent,
    description: `Every spend settles immediately, showing you exactly what you hold in this budget.
Instant feedback on current holdings, at the cost of tracking spending in real time.
This is the same behavior as a feed, but for inner pipes.`,
    shortDescription: "Settle spending immediately, to show exact holdings.",
  },
  spend_overflow: {
    id: "spend_overflow",
    group: "inner",
    title: "Overflow",
    icon: "overflow-pipe",
    color: colors.primary,
    description: `Track spending until it reaches a particular point, then settle and reset.
Useful for budgets that have a known limit, but where you want to track spending until it reaches that limit.
Think of a prepaid card, a budget for a specific event.`,
    shortDescription: "Settle when spending reaches capacity.",
  },
  cron: {
    id: "cron",
    group: "inner",
    title: "Timed",
    icon: "timer-outline",
    color: colors.secondary,
    description: `Accumulate spending until a certain interval passes, then settle.
Useful for budgets that have a known cycle.
Think of rent, subscriptions, yearly memberships or quarterly expenses.`,
    shortDescription: "Settle on a recurring schedule.",
  },
  self_destruct: {
    id: "self_destruct",
    group: "inner",
    title: "Self-destruct",
    icon: "bomb-pipe",
    color: colors.error,
    description: `Settle, then delete on a chosen date.
Useful for temporary budgets or those that should be removed after a certain time.
Think of travel budgets, temporary projects, or one-time events with multiple spendings.`,
    shortDescription: "Settle, then delete on a chosen date.",
  },
} satisfies { [Kind in PipeKind]: PipeChoice & { id: Kind } };

export function isFeedKind(kind: string | null) {
  return kind === "feed" || kind === "boiler";
}

export function isRuleId(value: unknown): value is RuleId {
  return typeof value === "string" && Object.values(PIPE_KINDS).some(choice => choice.group === "inner" && choice.id === value);
}

export function parsePipeKind(value: string): PipeKind {
  const choice = Object.values(PIPE_KINDS).find(item => item.id === value);
  if (!choice) throw new Error(`Unknown pipe type: ${value}`);
  return choice.id;
}

export const UNIT_OPTIONS = [
  { id: "days", label: "Day" },
  { id: "months", label: "Month" },
  { id: "years", label: "Year" },
] as const;
