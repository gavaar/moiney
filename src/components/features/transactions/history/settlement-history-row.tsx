import { Pressable, ScrollView, Text, View } from "react-native";
import { Icon, safeIconName, type IconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { PIPE_KINDS } from "@features/pipes/rules/config";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import type { SettlementEntry } from "./event-groups";

const causes: Record<SettlementEntry["cause"], string> = {
  manual: "Manually settled",
  spend_overflow: "Settled on spending limit",
  cron: "Scheduled settlement",
  self_destruct: "Settled before self-destruct",
};
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const detailDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
});

type SettlementCoveragePresentation = {
  amountCents: number; name: string; icon: string; direction: "received" | "provided";
};
type SettlementPresentationProps = { event: SettlementEntry };

function causeIcon(event: SettlementEntry): IconName {
  return event.cause === "manual" ? "gesture-tap-hold"
    : PIPE_KINDS[event.cause].icon;
}

function coverageDescription(coverage: SettlementCoveragePresentation) {
  return `${formatAmount(coverage.amountCents)} covered ${coverage.direction === "received" ? "by" : "for"} ${coverage.name}`;
}
function storedCoverage(event: SettlementEntry): SettlementCoveragePresentation | undefined {
  return event.coverage ? { ...event.coverage, direction: event.type === "settlement_coverage" ? "provided" : "received" } : undefined;
}

export function SettlementHistoryRow({ event, onPress }: SettlementPresentationProps & { onPress: () => void }) {
  const coverage = storedCoverage(event);
  const mirror = event.type === "settlement_coverage";
  return <Pressable accessibilityRole="button"
    accessibilityLabel={`View ${event.name} ${mirror ? "coverage" : "settlement"}${coverage ? `: ${coverageDescription(coverage)}` : ""}`}
    accessibilityHint={mirror ? "Coverage provided without settling this pipe" : causes[event.cause]} onPress={onPress}
    className="rounded-2xl border bg-secondaryMuted px-2 py-2" style={{ borderColor: colors.text }}>
    <View className="flex-row items-center gap-1">
      <Icon name={safeIconName(event.icon)} size={16} color={colors.muted} />
      <Text numberOfLines={1} className="text-text text-sm max-w-20 shrink">{event.name}</Text>
      <Icon name="chevron-back" size={12} color={colors.text} />
      <Icon name={causeIcon(event)} size={16} color={colors.secondary} />
      {coverage ? <View className="flex-row items-center gap-1 shrink-0">
        <Icon name="chevron-forward" size={12} color={colors.text} />
        <Icon name="shield" size={14} color={colors.secondary} />
        <Text className="text-errorMuted text-xs">{formatAmount(coverage.amountCents)}</Text>
        <Icon name={safeIconName(coverage.icon)} size={14} color={colors.muted} />
      </View> : null}
      <View className="flex-1" />
      <Text className="text-muted text-xs shrink-0">{dateFormatter.format(event.occurredAt)}</Text>
    </View>
  </Pressable>;
}

function AmountBar({ label, accessibilityLabel = label, amount, scale, color }: {
  label: string; accessibilityLabel?: string; amount: number; scale: number; color: string;
}) {
  const tint = amount < 0 ? colors.errorMuted : color;
  return <View accessible accessibilityLabel={`${accessibilityLabel}: ${formatAmount(amount)}`} className="flex-row items-center gap-3">
    <Text className="text-muted text-sm w-36 shrink">{label}</Text>
    <View className="h-1 flex-1 rounded-full bg-border overflow-hidden">
      <View className="h-1 rounded-full" style={{ backgroundColor: tint, width: `${Math.abs(amount) / scale * 100}%` }} />
    </View>
    <Text className="text-sm text-right min-w-14 shrink-0" style={{ color: tint }}>{formatAmount(amount)}</Text>
  </View>;
}

export function SettlementDetailsModal({ event, onClose }: SettlementPresentationProps & { onClose: () => void }) {
  const coverage = storedCoverage(event);
  const mirror = event.type === "settlement_coverage";
  const leftoverOverspending = mirror ? 0 : Math.max(0, event.before.spent - event.before.capacity - (coverage?.amountCents ?? 0));
  const pending = event.before.pendingFedAdjustment;
  const funding = mirror ? event.after.fed - event.after.spent : event.after.fed;
  const scale = Math.max(1, Math.abs(event.before.capacity), Math.abs(event.before.spent),
    Math.abs(pending), Math.abs(funding), Math.abs(event.after.capacity), leftoverOverspending, coverage?.amountCents ?? 0,
    mirror ? Math.abs(event.after.spent) : 0);
  return <ModalShell visible onClose={onClose}>
    <ScrollView contentContainerClassName="gap-4">
      <View className="gap-1">
        <View className="flex-row items-center gap-2">
          <Icon name={causeIcon(event)} size={20} color={colors.secondary} />
          <Text className="text-text text-lg font-bold flex-1">{mirror ? "Coverage provided" : causes[event.cause]}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Icon name={safeIconName(event.icon)} size={16} color={colors.muted} />
          <Text className="text-text flex-1">{event.name}</Text>
        </View>
        <Text className="text-muted text-sm">{detailDateFormatter.format(event.occurredAt)}</Text>
      </View>
      <View className="gap-3">
        <Text className="text-muted text-xs">{mirror ? "Before coverage" : "Before settlement"}</Text>
        <AmountBar label="Capacity" accessibilityLabel={`Capacity before ${mirror ? "coverage" : "settlement"}`} amount={event.before.capacity} scale={scale} color={colors.secondary} />
        <AmountBar label="Spent" accessibilityLabel={`Spent before ${mirror ? "coverage" : "settlement"}`} amount={event.before.spent} scale={scale} color={colors.errorMuted} />
      </View>
      {coverage ? <View accessible accessibilityLabel={coverageDescription(coverage)} className="flex-row items-center gap-3">
        <View className="w-36 shrink flex-row items-center flex-wrap gap-1">
          <Icon name="shield" size={16} color={colors.secondary} />
          <Text className="text-muted text-sm">Covered {mirror ? "for" : "by"}</Text>
          <Icon name={safeIconName(coverage.icon)} size={16} color={colors.muted} />
          <Text className="text-text text-sm shrink">{coverage.name}</Text>
        </View>
        <View className="h-1 flex-1 rounded-full bg-border overflow-hidden">
          <View className="h-1 rounded-full" style={{ backgroundColor: colors.errorMuted, width: `${coverage.amountCents / scale * 100}%` }} />
        </View>
        <Text className="text-errorMuted text-sm text-right min-w-14 shrink-0">{formatAmount(coverage.amountCents)}</Text>
      </View> : null}
      <View className="gap-3">
        {!mirror && leftoverOverspending > 0 ? <AmountBar label="Leftover overspending" amount={leftoverOverspending} scale={scale} color={colors.errorMuted} /> : null}
        {!mirror && pending !== 0 ? <AmountBar label={pending > 0 ? "Paid from elsewhere" : "Refunded elsewhere"}
          amount={Math.abs(pending)} scale={scale} color={colors.muted} /> : null}
        <Text className="text-muted text-xs">{mirror ? "After coverage" : "After settlement"}</Text>
        {mirror ? <AmountBar label="Spent after coverage" amount={event.after.spent} scale={scale} color={colors.errorMuted} /> : null}
        <AmountBar label={mirror ? "Available funding" : "Leftover funding"} amount={funding} scale={scale} color={colors.primaryMuted} />
        <AmountBar label={mirror ? "Capacity after coverage" : "New capacity"} amount={event.after.capacity} scale={scale} color={colors.secondary} />
      </View>
      <Text className="text-muted text-xs">{mirror ? "Coverage changes tracked spending, not funding. Original expenses stay with the spending pipe."
        : "Rule effects before tree redistribution. This event is not an expense."}</Text>
    </ScrollView>
  </ModalShell>;
}
