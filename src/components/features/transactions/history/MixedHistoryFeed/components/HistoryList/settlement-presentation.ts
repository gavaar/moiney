import type { IconName } from "@ui/Icon";
import { PIPE_KINDS } from "@features/pipes/rules/config";
import { formatAmount } from "@/lib/format";
import type { SettlementEntry } from "@features/transactions/history/events/event-groups";

export const causes: Record<SettlementEntry["cause"], string> = {
  manual: "Manually settled",
  spend_overflow: "Settled on spending limit",
  cron: "Scheduled settlement",
  self_destruct: "Settled before self-destruct",
};
type SettlementCoveragePresentation = {
  amountCents: number; name: string; icon: string; direction: "received" | "provided";
};

export function causeIcon(event: SettlementEntry): IconName {
  return event.cause === "manual" ? "gesture-tap-hold"
    : PIPE_KINDS[event.cause].icon;
}

export function coverageDescription(coverage: SettlementCoveragePresentation) {
  return `${formatAmount(coverage.amountCents)} covered ${coverage.direction === "received" ? "by" : "for"} ${coverage.name}`;
}

export function storedCoverage(event: SettlementEntry): SettlementCoveragePresentation | undefined {
  return event.coverage ? { ...event.coverage, direction: event.type === "settlement_coverage" ? "provided" : "received" } : undefined;
}
