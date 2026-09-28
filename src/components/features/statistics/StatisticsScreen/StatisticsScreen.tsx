import { api } from "@convex/_generated/api";
import { AppScreenHeader } from "@features/app/AppScreenHeader";
import { type MonthlySpendingStat } from "@features/statistics/data/monthlySpending";
import { MonthlyStatisticsCard } from "@features/statistics/MonthlyStatisticsCard";
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
};

export function StatisticsScreen({ onSelectPeriod }: Props) {
  const reports = useQuery(api.monthlySpendingStats.listMine, {});
  const pipes = useQuery(api.pipes.getPipes, reports?.some((report) => report.offenders?.length) ? {} : "skip");

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
          renderItem={({ item }) => <MonthlyStatisticsCard report={item} offenderIcon={pipes?.find((pipe) => pipe._id === item.offenders?.[0]?.pipeId)?.icon} onPress={() => onSelectPeriod(item.periodStart)} />}
        />
      )}
    </SafeAreaView>
  );
}
