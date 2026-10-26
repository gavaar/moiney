import type { IconName } from "@ui/Icon";
import type { PipeRule } from "@domain/pipes/rules";

export type PipeKind = "feed" | "boiler" | "none" | PipeRule;
type PipeChoice = { id: PipeKind; group: "feeds" | "inner"; title: string; icon: IconName; description: string; explanation: string };

// Selection artwork is deliberately independent of persisted/custom pipe icons.
export const PIPE_CHOICES: readonly PipeChoice[] = [
  {
    id: "feed",
    group: "feeds",
    title: "Basic feed",
    icon: "pipe",
    description: "Bring money into your budget.",
    explanation: "A source for money entering your budget, such as an account, cash, or a wallet. Childless feeds settle spending instantly.",
  },
  {
    id: "boiler",
    group: "feeds",
    title: "Boiler",
    icon: "pipe",
    description: "Track current value and contributions separately.",
    explanation: "Tracks current value and contributed principal separately, such as an investment account. Childless boilers settle spending instantly.",
  },
  {
    id: "none",
    group: "inner",
    title: "Manual",
    icon: "pipe",
    description: "Accumulate spending; settle when you choose.",
    explanation: "Accumulates spending until you settle it manually. Capacity is a budget, not a spending limit.",
  },
  {
    id: "instant_settlement",
    group: "inner",
    title: "Instant",
    icon: "pipe",
    description: "Settle spending immediately, like a feed.",
    explanation: "Settles whenever spending changes, just like a childless feed. Spending does not accumulate between settlements.",
  },
  {
    id: "spend_overflow",
    group: "inner",
    title: "Overflow",
    icon: "pipe",
    description: "Settle when spending reaches capacity.",
    explanation: "Accumulates spending. Settles when spending reaches or exceeds capacity.",
  },
  {
    id: "cron",
    group: "inner",
    title: "Timed",
    icon: "pipe",
    description: "Settle on a recurring schedule.",
    explanation: "Accumulates spending, even above capacity. Settles at each scheduled interval.",
  },
  {
    id: "self_destruct",
    group: "inner",
    title: "Self-destruct",
    icon: "pipe",
    description: "Settle, then delete on a chosen date.",
    explanation: "Accumulates spending, even above capacity. On or after the chosen date, applies contingency if available, settles, then deletes the pipe. Remaining money or debt returns to its owner.",
  },
];

export function isFeedKind(kind: string | null) { return kind === "feed" || kind === "boiler"; }

export function parsePipeKind(value: string): PipeKind {
  const choice = PIPE_CHOICES.find(item => item.id === value);
  if (!choice) throw new Error(`Unknown pipe type: ${value}`);
  return choice.id;
}
