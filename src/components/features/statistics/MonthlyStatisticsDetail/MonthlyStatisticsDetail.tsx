import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@ui/Icon";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { colors } from "@/lib/styles";
import { ReportContent } from "../ReportContent";

type Props = { periodStart: number; onBack: () => void };

export function MonthlyStatisticsDetail({ periodStart, onBack }: Props) {
  const report = useQuery(api.monthlySpendingStats.getMine, { periodStart });
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <View className="px-4">
        <ScreenHeader title="Spending report" left={
          <Pressable accessibilityRole="button" accessibilityLabel="Back to statistics"
            className="h-10 w-10 items-start justify-center" onPress={onBack}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        } />
      </View>
      {report === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator accessibilityLabel="Loading monthly report" color={colors.primary} />
        </View>
      ) : report === null ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-lg text-muted">This monthly report is not available.</Text>
        </View>
      ) : <ReportContent report={report} />}
    </SafeAreaView>
  );
}
