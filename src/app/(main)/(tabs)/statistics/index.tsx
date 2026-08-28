import { StatisticsScreen } from "@features/statistics/StatisticsScreen";
import { useRouter } from "expo-router";

export default function StatisticsRoute() {
  const router = useRouter();

  return (
    <StatisticsScreen
      onSelectPeriod={(periodStart) => router.push(`/statistics/${periodStart}`)}
    />
  );
}
