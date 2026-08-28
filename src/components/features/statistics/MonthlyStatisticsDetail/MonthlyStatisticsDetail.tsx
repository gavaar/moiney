import { api } from "@convex/_generated/api";
import {
  averageSpendingCents,
  formatMonthYear,
  netSpendingCents,
  type MonthlySpendingStat,
} from "@features/statistics/data/monthlySpending";
import { Icon } from "@ui/Icon";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { formatAmount } from "@/lib/format";
import { colors } from "@/lib/styles";
import { useQuery } from "convex/react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  periodStart: number;
  onBack: () => void;
};

type MetricProps = {
  label: string;
  value: string;
  tone?: "default" | "primary" | "secondary";
};

function Metric({ label, value, tone = "default" }: MetricProps) {
  const valueClass =
    tone === "primary"
      ? "text-primary"
      : tone === "secondary"
        ? "text-secondary"
        : "text-text";

  return (
    <View className="gap-1 rounded-xl border border-border bg-surface p-4">
      <Text className="text-sm text-muted">{label}</Text>
      <Text selectable className={`text-xl font-bold ${valueClass}`}>
        {value}
      </Text>
    </View>
  );
}

export function MonthlyStatisticsDetail({ periodStart, onBack }: Props) {
  const report = useQuery(api.monthlySpendingStats.getMine, { periodStart });

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      <View className="px-4">
        <ScreenHeader
          title="Spending report"
          left={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to statistics"
              className="h-10 w-10 items-start justify-center"
              onPress={onBack}
            >
              <Icon name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          }
        />
      </View>

      {report === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            accessibilityLabel="Loading monthly report"
            color={colors.primary}
          />
        </View>
      ) : report === null ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-lg text-muted">
            This monthly report is not available.
          </Text>
        </View>
      ) : (
        <ReportContent report={report} />
      )}
    </SafeAreaView>
  );
}

function ReportContent({ report }: { report: MonthlySpendingStat }) {
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-3 px-4 pb-8"
    >
      <View className="gap-2 rounded-2xl border border-border bg-surface p-5">
        <Text className="text-sm font-semibold uppercase tracking-wider text-primary">
          Monthly overview
        </Text>
        <Text selectable className="text-3xl font-bold text-text">
          {formatMonthYear(report.periodStart)}
        </Text>
        <Text className="text-muted">
          A frozen summary captured after the month closed.
        </Text>
      </View>

      {report.totalIncomeCents !== undefined ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Metric
              label="Total income"
              value={formatAmount(report.totalIncomeCents)}
              tone="primary"
            />
          </View>
          <View className="flex-1">
            <Metric
              label="Total outcome"
              value={formatAmount(netSpendingCents(report))}
            />
          </View>
        </View>
      ) : (
        <Metric
          label="Total outcome"
          value={formatAmount(netSpendingCents(report))}
        />
      )}
      {report.volumeCents !== undefined || report.producedCents !== undefined ? (
        <View className="flex-row gap-3">
          {report.volumeCents !== undefined ? (
            <View className="flex-1">
              <Metric
                label="Volume"
                value={formatAmount(report.volumeCents)}
                tone="secondary"
              />
            </View>
          ) : null}
          {report.producedCents !== undefined ? (
            <View className="flex-1">
              <Metric
                label="Produced"
                value={formatAmount(report.producedCents)}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Metric
            label="Gross spending"
            value={formatAmount(report.grossSpendingCents)}
          />
        </View>
        <View className="flex-1">
          <Metric
            label="Refunds"
            value={formatAmount(report.refundCents)}
            tone="secondary"
          />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Metric
            label="Spending transactions"
            value={String(report.spendingTransactionCount)}
          />
        </View>
        <View className="flex-1">
          <Metric
            label="Refund transactions"
            value={String(report.refundTransactionCount)}
          />
        </View>
      </View>
      <Metric
        label="Average spending"
        value={formatAmount(averageSpendingCents(report))}
      />
      <Metric
        label="Largest spending transaction"
        value={formatAmount(report.largestSpendingTransactionCents)}
      />
    </ScrollView>
  );
}
