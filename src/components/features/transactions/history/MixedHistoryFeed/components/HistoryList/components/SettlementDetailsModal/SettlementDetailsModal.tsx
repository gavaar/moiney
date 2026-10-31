import { ScrollView, Text, View } from "react-native";
import { Icon, safeIconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import type { SettlementEntry } from "@features/transactions/history/events/event-groups";
import { causes, causeIcon, coverageDescription, storedCoverage } from "../../settlement-presentation";

const detailDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
});

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

export function SettlementDetailsModal({ event, onClose }: { event: SettlementEntry; onClose: () => void }) {
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
          <Icon name="shield" size={16} color={colors.warning} />
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
