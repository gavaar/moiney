import { api } from "@convex/_generated/api";
import {
  averageSpendingCents,
  formatMonthYear,
  netSpendingCents,
  type MonthlySpendingStat,
} from "@features/statistics/data/monthlySpending";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { Icon, safeIconName } from "@ui/Icon";
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
  tone?: "default" | "primary" | "secondary" | "error" | "errorMuted" | "accent";
};

function Metric({ label, value, tone = "default" }: MetricProps) {
  const valueClass = {
    default: "text-text",
    primary: "text-primary",
    secondary: "text-secondary",
    error: "text-error",
    errorMuted: "text-errorMuted",
    accent: "text-accent",
  }[tone];

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

export function ReportContent({ report, live = false }: { report: MonthlySpendingStat; live?: boolean }) {
  const { allPipes } = usePipeCatalog();
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
          {live ? "Live current-month summary. Volume and Produced are current balances." : "A frozen summary captured after the month closed."}
        </Text>
      </View>

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
          {report.producedCents !== undefined && report.producedCents !== report.volumeCents ? (
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
        {report.totalIncomeCents !== undefined ? (
          <View className="flex-1">
            <Metric label="Income" value={formatAmount(report.totalIncomeCents)} tone="primary" />
          </View>
        ) : null}
        <View className="flex-1">
          <Metric label="Outcome" value={formatAmount(netSpendingCents(report))} tone="error" />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
            <Metric
              label="Gross spending"
              value={formatAmount(report.grossSpendingCents)}
              tone="errorMuted"
          />
        </View>
        <View className="flex-1">
          <Metric
            label="Refunds"
            value={formatAmount(report.refundCents)}
            tone="accent"
          />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Metric
              label="Spending transactions"
              value={String(report.spendingTransactionCount)}
              tone="errorMuted"
          />
        </View>
        <View className="flex-1">
          <Metric
              label="Refund transactions"
              value={String(report.refundTransactionCount)}
              tone="accent"
          />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="min-w-0 flex-1">
          <Metric label="Transaction average" value={formatAmount(averageSpendingCents(report))} />
        </View>
        <View className="min-w-0 flex-1">
          <View className="gap-1 rounded-xl border border-border bg-surface p-4">
            <Text className="text-sm text-muted">Most repeated</Text>
            {report.mostRepeatedTransaction ? (
              <Text selectable className="text-base font-bold text-text">
                {report.mostRepeatedTransaction.title} · <Text className="text-warning">{formatAmount(report.mostRepeatedTransaction.netSpendingCents)}</Text> <Text className="text-muted">({report.mostRepeatedTransaction.count}x)</Text>
              </Text>
            ) : (
              <Text className="text-base text-muted">No repeat info yet</Text>
            )}
          </View>
        </View>
      </View>
      <View className="gap-1 rounded-xl border border-border bg-surface p-4">
        <Text className="text-sm text-muted">Largest spending transaction</Text>
        <View className="gap-1">
          {report.largestSpendingTransactions?.length ? report.largestSpendingTransactions.map((transaction, index) => (
            <Text key={index} selectable className={index === 0 ? "text-xl font-bold text-text" : index === 1 ? "text-base text-muted" : "text-sm text-muted"}>
              {transaction.title} · {formatAmount(transaction.amountCents)}
            </Text>
          )) : (
            <>
              <Text selectable className="text-xl font-bold text-text">{formatAmount(report.largestSpendingTransactionCents)}</Text>
              {report.nextLargestSpendingCents?.map((amount, index) => (
                <Text key={index} selectable className={index === 0 ? "text-base text-muted" : "text-sm text-muted"}>{formatAmount(amount)}</Text>
              ))}
            </>
          )}
        </View>
      </View>
      <View className="gap-2 rounded-xl border border-border bg-surface p-4">
        <Text className="text-lg font-bold text-text">Biggest offenders</Text>
        {report.offenders === undefined ? (
          <Text className="text-muted">Unavailable for this month.</Text>
        ) : report.offenders.length === 0 ? (
          <Text className="text-muted">No offenders exceeded capacity.</Text>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {report.offenders.map((offender, index) => {
              const icon = allPipes?.find((pipe) => pipe.id === offender.pipeId)?.icon;
              return (
              <View key={offender.pipeId} className="basis-32 flex-grow gap-1 rounded-lg border border-border bg-background p-3">
                  <View className="flex-row items-center gap-1">
                    {icon ? <Icon name={safeIconName(icon)} size={16} color={colors.muted} testID={`offender-pipe-icon-${index + 1}`} /> : null}
                    <Text className="min-w-0 flex-1 font-semibold text-text">{offender.name}</Text>
                    <Text className="text-sm text-muted">#{index + 1}</Text>
                  </View>
                <Text className="text-muted">Net spent {formatAmount(offender.netSpendingCents)}</Text>
                <Text className="text-muted">Capacity {formatAmount(offender.capacityCents)}</Text>
                <Text className="text-text">Over by {formatAmount(offender.overageCents)}</Text>
              </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
