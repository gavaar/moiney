import { Pressable, Text, View } from "react-native";
import { Icon, safeIconName } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { HistoryEventMarker } from "@features/transactions/components/HistoryEventMarker/HistoryEventMarker";
import type { SettlementEntry } from "@features/transactions/history/events/event-groups";
import { causes, causeIcon, coverageDescription, storedCoverage } from "../../../../settlement-presentation";

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function SettlementHistoryRow({ event, onPress }: { event: SettlementEntry; onPress: () => void }) {
  const coverage = storedCoverage(event);
  const mirror = event.type === "settlement_coverage";

  return <View className="flex-row gap-1">
    <HistoryEventMarker eventType={event.type} color={mirror ? colors.warning : colors.secondary} />

    <Pressable accessibilityRole="button"
      accessibilityLabel={`View ${event.name} ${mirror ? "coverage" : "settlement"}${coverage ? `: ${coverageDescription(coverage)}` : ""}`}
      accessibilityHint={mirror ? "Coverage provided without settling this pipe" : causes[event.cause]}
      onPress={onPress}
      className="flex-1 rounded-2xl border bg-secondaryMuted px-2 py-2"
      style={{ borderColor: colors.text }}>
      <View className="flex-row items-center gap-1">
        <Icon name={safeIconName(event.icon)} size={16} color={colors.muted} />
        <Text numberOfLines={1} className="text-text text-sm max-w-20 shrink">{event.name}</Text>
        <Icon name="chevron-back" size={12} color={colors.text} />
        <Icon name={causeIcon(event)} size={16} color={colors.secondary} />
        {coverage ? <View className="flex-row items-center gap-1 shrink-0">
          <Icon name="chevron-forward" size={12} color={colors.text} />
          <Icon name="shield" size={14} color={colors.warning} />
          <Text className="text-errorMuted text-xs">{formatAmount(coverage.amountCents)}</Text>
          <Icon name={safeIconName(coverage.icon)} size={14} color={colors.muted} />
        </View> : null}
        <View className="flex-1" />
        <Text className="text-muted text-xs shrink-0">{dateFormatter.format(event.occurredAt)}</Text>
      </View>
    </Pressable>
  </View>;
}
