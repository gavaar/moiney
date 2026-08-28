import { MonthlyStatisticsDetail } from "@features/statistics/MonthlyStatisticsDetail";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

export default function MonthlyStatisticsRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ "period-start"?: string | string[] }>();
  const rawPeriodStart = params["period-start"];
  const periodStart = Number(
    Array.isArray(rawPeriodStart) ? rawPeriodStart[0] : rawPeriodStart,
  );
  const period = new Date(periodStart);
  const isValidPeriod =
    Number.isSafeInteger(periodStart) &&
    period.getTime() === periodStart &&
    period.getUTCDate() === 1 &&
    period.getUTCHours() === 0 &&
    period.getUTCMinutes() === 0 &&
    period.getUTCSeconds() === 0 &&
    period.getUTCMilliseconds() === 0;

  if (!isValidPeriod) return <Redirect href="/statistics" />;

  return (
    <MonthlyStatisticsDetail
      periodStart={periodStart}
      onBack={() => router.back()}
    />
  );
}
