import { useRouter } from "expo-router";
import { CurrentMonthStatisticsDetail } from "@features/statistics/CurrentMonthStatisticsDetail";

export default function CurrentMonthRoute() {
  const router = useRouter();
  return <CurrentMonthStatisticsDetail onBack={() => router.back()} />;
}
