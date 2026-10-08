import { Pressable, Text, View } from "react-native";
import { Icon, safeIconName } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { formatMonthYear, netSpendingCents, type MonthlySpendingStat } from "./data/monthlySpending";

export function MonthlyStatisticsCard({ report, onPress, live = false, offenderIcon }: {
  report: MonthlySpendingStat;
  onPress: () => void;
  live?: boolean;
  offenderIcon?: string;
}) {
  const month = formatMonthYear(report.periodStart);
  const offender = report.offenders?.[0];
  const netChange = report.totalIncomeCents === undefined ? undefined : report.totalIncomeCents - netSpendingCents(report);
  const netChangeTone = netChange === undefined ? "text-muted" : netChange > 0 ? "text-primaryMuted" : netChange < 0 ? "text-errorMuted" : "text-text";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${month} ${live ? "live " : ""}spending report`}
      className="gap-2 rounded-xl border border-border bg-surface p-4 active:opacity-80"
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-text">{month}{live ? <Text className="text-primary"> · Live</Text> : ""}</Text>
        <Icon name="chevron-forward" size={20} color={colors.muted} />
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm text-muted">Net change</Text>
          <Text className={`text-2xl font-bold ${netChangeTone}`} adjustsFontSizeToFit numberOfLines={1}>{netChange === undefined ? "Unavailable" : formatAmount(netChange)}</Text>
        </View>
        <View className="items-end">
          <Text className="text-sm text-muted">Income <Text className="text-primaryMuted">{report.totalIncomeCents === undefined ? "Unavailable" : formatAmount(report.totalIncomeCents)}</Text></Text>
          <Text className="text-sm text-muted">Outcome <Text className="text-errorMuted">{formatAmount(report.grossSpendingCents)}</Text></Text>
          <Text className="text-sm text-muted">Refunds: <Text className="text-accentMuted">{formatAmount(report.refundCents)}</Text></Text>
        </View>
      </View>
      <View className="gap-1">
        <View className="flex-row flex-wrap items-center gap-1">
          <Text className="text-sm text-muted">Biggest offender:</Text>
          {offender && offenderIcon ? <Icon name={safeIconName(offenderIcon)} size={16} color={colors.muted} testID="offender-pipe-icon" /> : null}
          {offender ? (
            <Text className="text-sm text-muted">{offender.name} · <Text className="text-warning">{formatAmount(offender.overageCents)}</Text></Text>
          ) : <Text className="text-sm text-muted">{report.offenders === undefined ? "Unavailable" : "No offenders"}</Text>}
        </View>
        <View className="flex-row flex-wrap items-center gap-1">
          <Text className="text-sm text-muted">Most repeated:</Text>
          {report.mostRepeatedTransaction ? (
            <Text className="text-sm text-muted">
              {report.mostRepeatedTransaction.title} · <Text className="text-warning">{formatAmount(report.mostRepeatedTransaction.netSpendingCents)}</Text> ({report.mostRepeatedTransaction.count}x)
            </Text>
          ) : <Text className="text-sm text-muted">{report.mostRepeatedTransaction === undefined ? "Unavailable" : "No repeats"}</Text>}
        </View>
      </View>
    </Pressable>
  );
}
