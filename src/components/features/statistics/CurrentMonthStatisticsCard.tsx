import { ActivityIndicator } from "react-native";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { colors } from "@/lib/styles";
import { useCurrentMonthReportContext } from "./CurrentMonthReportContext";
import { MonthlyStatisticsCard } from "./MonthlyStatisticsCard";

export function CurrentMonthStatisticsCard({ onPress }: { onPress?: () => void }) {
  const { report } = useCurrentMonthReportContext();
  const { allPipes } = usePipeCatalog();
  return report ? (
    <MonthlyStatisticsCard report={report} live offenderIcon={allPipes?.find((pipe) => pipe.id === report.offenders?.[0]?.pipeId)?.icon} onPress={() => onPress?.()} />
  ) : (
    <ActivityIndicator accessibilityLabel="Loading current month summary" color={colors.primary} />
  );
}
