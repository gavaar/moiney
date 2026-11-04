import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@ui/Icon";
import { AppScreenHeader } from "@features/app/AppScreenHeader";
import { colors } from "@/lib/styles";
import { ReportContent } from "./ReportContent";
import { useCurrentMonthReportContext } from "./CurrentMonthReportContext";

export function CurrentMonthStatisticsDetail({ onBack, backLabel = "Back to Pipes" }: { onBack: () => void; backLabel?: string }) {
  const { report } = useCurrentMonthReportContext();
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppScreenHeader
        title="Live spending report"
        left={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            className="h-10 w-10 items-start justify-center rounded-sm web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-primary"
            onPress={onBack}
          >
            <Icon name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        }
      />
      {report ? <ReportContent report={report} live /> : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator accessibilityLabel="Loading live report" color={colors.primary} />
          <Text className="text-muted">Loading current month…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
