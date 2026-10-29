import { api } from "@convex/_generated/api";
import { AppScreenHeader } from "@features/app/AppScreenHeader";
import { MonthlyStatisticsCard } from "@features/statistics/MonthlyStatisticsCard";
import { CurrentMonthStatisticsCard } from "@features/statistics/CurrentMonthStatisticsCard";
import { colors } from "@/lib/styles";
import { useQuery } from "convex/react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  onSelectPeriod: (periodStart: number) => void;
  onOpenCurrentReport?: () => void;
};

export function StatisticsScreen({ onSelectPeriod, onOpenCurrentReport }: Props) {
  const reports = useQuery(api.monthlySpendingStats.listMine, {});
  const pipes = useQuery(api.pipes.getPipes, reports?.some((report) => report.offenders?.length) ? {} : "skip");

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      <AppScreenHeader title="Statistics" />
      <FlatList
        data={reports ?? []}
        keyExtractor={(item) => String(item.periodStart)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-3 px-2 pb-4"
        ListHeaderComponent={<CurrentMonthStatisticsCard onPress={onOpenCurrentReport} />}
        ListEmptyComponent={reports === undefined ? (
          <View className="items-center justify-center py-8">
            <ActivityIndicator
              accessibilityLabel="Loading monthly statistics"
              color={colors.primary}
            />
          </View>
        ) : (
          <View className="items-center justify-center px-4 py-8">
            <Text className="text-muted text-center text-lg">
              No monthly statistics yet.
            </Text>
          </View>
        )}
        renderItem={({ item }) => <MonthlyStatisticsCard report={item} offenderIcon={pipes?.find((pipe) => pipe._id === item.offenders?.[0]?.pipeId)?.icon} onPress={() => onSelectPeriod(item.periodStart)} />}
      />
    </SafeAreaView>
  );
}
