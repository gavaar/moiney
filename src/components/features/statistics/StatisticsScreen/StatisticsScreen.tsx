import { api } from "@convex/_generated/api";
import { AppScreenHeader } from "@features/app/AppScreenHeader";
import {
  formatMonthYear,
  netSpendingCents,
  type MonthlySpendingStat,
} from "@features/statistics/data/monthlySpending";
import { Icon } from "@ui/Icon";
import { formatAmount } from "@/lib/format";
import { colors } from "@/lib/styles";
import { useQuery } from "convex/react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  onSelectPeriod: (periodStart: number) => void;
};

export function StatisticsScreen({ onSelectPeriod }: Props) {
  const reports = useQuery(api.monthlySpendingStats.listMine, {});

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      <AppScreenHeader title="Statistics" />
      {reports === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            accessibilityLabel="Loading monthly statistics"
            color={colors.primary}
          />
        </View>
      ) : reports.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-muted text-center text-lg">
            No monthly statistics yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={reports as MonthlySpendingStat[]}
          keyExtractor={(item) => String(item.periodStart)}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="gap-3 px-4 pb-4"
          renderItem={({ item }) => {
            const month = formatMonthYear(item.periodStart);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${month} spending report`}
                className="gap-3 rounded-2xl border border-border bg-surface p-4 active:opacity-80"
                onPress={() => onSelectPeriod(item.periodStart)}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-text">{month}</Text>
                  <Icon name="chevron-forward" size={20} color={colors.muted} />
                </View>
                <View>
                  <Text className="text-sm text-muted">Total outcome</Text>
                  <Text className="text-2xl font-bold text-text">
                    {formatAmount(netSpendingCents(item))}
                  </Text>
                </View>
                <View className="flex-row gap-4">
                  <Text className="text-sm text-muted">
                    Gross {formatAmount(item.grossSpendingCents)}
                  </Text>
                  <Text className="text-sm text-muted">
                    Refunds {formatAmount(item.refundCents)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
