import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@ui/Icon";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { colors } from "@/lib/styles";
import { ReportContent } from "./MonthlyStatisticsDetail/MonthlyStatisticsDetail";
import { useCurrentMonthReportContext } from "./CurrentMonthReportContext";

export function CurrentMonthStatisticsDetail({ onBack }: { onBack: () => void }) {
  const { report } = useCurrentMonthReportContext();
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <View className="px-4">
        <ScreenHeader title="Live spending report" left={
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Pipes" className="h-10 w-10 items-start justify-center" onPress={onBack}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        } />
      </View>
      {report ? <ReportContent report={report} live /> : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator accessibilityLabel="Loading live report" color={colors.primary} />
          <Text className="text-muted">Loading current month…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
