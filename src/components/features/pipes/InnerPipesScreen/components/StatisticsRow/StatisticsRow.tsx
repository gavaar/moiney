import { type ReactNode, RefObject, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Popover } from "@ui/Popover";
import { Icon, type IconName } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { prepareContingencyPreview } from "@features/pipes/data/contingencyPreview";
import { RemainingExpectedDetails } from "./RemainingExpectedDetails";
import { monthlySpendingPace } from "@domain/statistics/monthlySpendingPace";

const DAY_MS = 24 * 60 * 60 * 1000;

type StatItem = {
  displayValue: string;
  title: string;
  description: ReactNode;
  guidance?: string;
  ref: RefObject<View | null>;
  icon: IconName;
  testID?: string;
  tone?: "external" | "negative" | "positive" | "growth-non-negative" | "warning";
};

type Props = {
  fed: number;
  spent: number;
  monthlySpent: number | undefined;
  expected: number;
  pendingFedAdjustment?: number;
  sourceType?: "feed" | "boiler";
  contributedFed?: number;
  now: number;
};

function formatSignedAmount(value: number): string {
  const formatted = formatAmount(Math.round(value));
  return value > 0 ? `+${formatted}` : formatted;
}

function formatGrowthPercentage(value: number): string {
  const rounded = Number(value.toFixed(2));
  if (rounded === 0) return "0%";
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function StatisticsRow({
  fed,
  spent,
  monthlySpent,
  expected,
  pendingFedAdjustment = 0,
  sourceType,
  contributedFed = 0,
  now,
}: Props) {
  const date = new Date(now);
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const currentDay = date.getUTCDate();
  const pace = monthlySpent === undefined ? undefined : monthlySpendingPace(monthlySpent, now);
  const dailyExpected = daysInMonth > 0 ? expected / daysInMonth : 0;
  const accruedAllowance = dailyExpected * currentDay;
  const accumulatedSpend = monthlySpent === undefined ? undefined : accruedAllowance - monthlySpent;
  const daysUntilPositive =
    accumulatedSpend !== undefined && accumulatedSpend < 0 && dailyExpected > 0
      ? Math.floor(-accumulatedSpend / dailyExpected) + 1
      : null;
  const growth =
    sourceType === "boiler" && contributedFed !== 0
      ? ((fed - contributedFed) / contributedFed) * 100
      : null;
  const growthLabel = growth === null ? "N/A" : formatGrowthPercentage(growth);
  const [selectedStatTitle, setSelectedStatTitle] = useState<string | null>(
    null,
  );
  const remainingExpectedRef = useRef<View>(null);
  const stmpdRef = useRef<View>(null);
  const astmRef = useRef<View>(null);
  const cronRef = useRef<View>(null);
  const externalRef = useRef<View>(null);
  const growthRef = useRef<View>(null);
  const coverageRef = useRef<View>(null);
  const coverageProvidedRef = useRef<View>(null);
  const { selectedPipePath } = usePipeSelection();
  const { pipesById } = usePipeCatalog();

  const selectedId =
    selectedPipePath.length > 0
      ? selectedPipePath[selectedPipePath.length - 1]
      : null;
  const currentPipe = selectedId && pipesById ? pipesById[selectedId] : null;
  const preview = prepareContingencyPreview(Object.values(pipesById ?? {}));
  const coverage = selectedId ? preview.forSource(selectedId) : undefined;
  const coverageProvided = selectedId ? preview.forDonor(selectedId) : undefined;

  const daysLeft =
    (currentPipe?.rule === "cron" || currentPipe?.rule === "self_destruct") && currentPipe.cronNextDate != null
      ? Math.max(0, Math.ceil((currentPipe.cronNextDate - now) / DAY_MS))
      : null;

  const stats: StatItem[] = [
    ...(coverageProvided ? [
      {
        displayValue: formatAmount(coverageProvided.amountCents),
        title: "Possible coverage provided",
        tone: "warning" as const,
        description: `This pipe could provide ${formatAmount(coverageProvided.amountCents)} in total if all eligible pipes selecting it settled now (${coverageProvided.sources.map(source => source.name).join(", ")}). They share this pipe's unspent funding to cover spending above capacity or carried-forward debt. Original expenses stay attributed to those pipes.`,
        guidance: "This funding is not reserved. Actual coverage depends on changing balances and settlement order, including scheduled sharing.",
        icon: "shield" as IconName,
        ref: coverageProvidedRef,
      }
    ] : []),
    ...(coverage ? [
      {
        displayValue: formatAmount(coverage.amountCents),
        title: "Possible coverage",
        tone: "warning" as const,
        description: `${coverage.donor.name} could cover ${formatAmount(coverage.amountCents)} if this pipe settled now, using its unspent funding to cover spending above capacity or carried-forward debt. Coverage is applied only at settlement; your original expenses remain attributed to this pipe.`,
        guidance: "This funding is not reserved. Changing balances and sharing with other scheduled settlements can reduce actual coverage.",
        icon: "shield" as IconName,
        ref: coverageRef,
      }
    ] : []),
    ...(sourceType !== "boiler"
      ? [
        {
          displayValue: formatAmount(expected - spent),
          title: "Remaining expected",
          description: <RemainingExpectedDetails expected={expected} spent={spent} fed={fed} pendingFedAdjustment={pendingFedAdjustment} />,
          icon: "circle-half-full" as IconName,
          ref: remainingExpectedRef,
        },
      ]
      : []),
    {
      displayValue: pace ? formatAmount(Math.round(pace.dailyAverageCents)) : "Loading",
      title: "Spent this month per day",
      description: pace ? (
        <View className="gap-2">
          <Text className="text-text text-sm">
            {pace.dailyAverageCents < 0 ? "Net spending averaged " : "An average of "}
            <Text className="text-errorMuted">{formatAmount(Math.round(pace.dailyAverageCents))}</Text>
            {pace.dailyAverageCents < 0 ? " per day over " : " was spent per day over "}
            <Text className="text-secondary">{pace.elapsedDays}</Text>
            {" "}{pace.elapsedDays === 1 ? "day" : "days"} this month.
          </Text>
          <Text className="text-text text-sm">
            If maintained, you would spend{" "}
            <Text className={pace.projectedCents > expected ? "text-errorDark" : "text-primaryDark"}>
              {formatAmount(pace.projectedCents)}
            </Text>
            {" "}by the end of the month.
          </Text>
          {pace.projectedCents > expected ? (
            <Text className="text-text text-sm">
              This would set you above your expected spend goal by{" "}
              <Text className="text-error">{formatAmount(pace.projectedCents - expected)}</Text>.
            </Text>
          ) : (
            <Text className="text-text text-sm">
              Leaving you with{" "}
              <Text className="text-primary">{formatAmount(expected - pace.projectedCents)}</Text>
              {" "}leftover.
            </Text>
          )}
        </View>
      ) : <Text className="text-muted text-sm">Loading monthly spending…</Text>,
      icon: "calculate",
      ref: stmpdRef,
    },
    {
      displayValue: accumulatedSpend === undefined ? "Loading" : formatAmount(Math.round(accumulatedSpend)),
      title: "Accumulated spend this month",
      tone: accumulatedSpend === undefined ? undefined : accumulatedSpend < 0 ? "negative" : "positive",
      description: accumulatedSpend !== undefined && monthlySpent !== undefined ? (
        <View className="gap-2">
          <Text className="text-text text-sm">
            This month’s expected spending is <Text className="text-secondary">{formatAmount(expected)}</Text>,
            {" or "}<Text className="text-secondary">{formatAmount(Math.round(dailyExpected))}</Text> per day.
          </Text>
          <Text className="text-text text-sm">
            Adding up to today, that gives you an allowance of{" "}
            <Text className="text-primary">{formatAmount(Math.round(accruedAllowance))}</Text>.
          </Text>
          <Text className="text-text text-sm">
            You’ve spent <Text className="text-errorMuted">{formatAmount(monthlySpent)}</Text> this month,
            {" leaving an accumulated allowance of "}
            <Text className={accumulatedSpend < 0 ? "text-error" : "text-primary"}>
              {formatAmount(Math.round(accumulatedSpend))}
            </Text>.
          </Text>
        </View>
      ) : <Text className="text-muted text-sm">Loading monthly spending…</Text>,
      guidance: accumulatedSpend !== undefined && accumulatedSpend < 0
        ? daysUntilPositive !== null &&
            daysUntilPositive <= daysInMonth - currentDay
          ? `Assuming no further spending, this value will be positive again in ${daysUntilPositive} ${daysUntilPositive === 1 ? "day" : "days"}.`
          : "You’ve used up this month’s allowance. Avoid further spending this month."
        : undefined,
      icon: "playlist-add",
      ref: astmRef,
    },
    ...(sourceType === "boiler"
      ? [
        {
          displayValue: growthLabel,
          title: "Growth",
          description: `This pipe has received ${formatAmount(contributedFed)} value, but now holds ${formatAmount(fed)}, meaning it has grown ${growthLabel}.`,
          icon: "trending-up" as IconName,
          ref: growthRef,
          testID: "boiler-growth-chip",
          tone:
                growth !== null && growth < 0
                   ? ("negative" as const)
                  : ("growth-non-negative" as const),
        },
      ]
      : []),
    ...(daysLeft != null && currentPipe?.cronNextDate != null
      ? [
        {
          displayValue: String(daysLeft),
          title: "Days left",
           description: `This pipe will ${currentPipe.rule === "self_destruct" ? "self-destroy" : "reset"} automatically in ${daysLeft} ${daysLeft === 1 ? "day" : "days"} (${new Date(currentPipe.cronNextDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}).`,
          icon: "timer-outline" as IconName,
          ref: cronRef,
        },
      ]
      : []),
    ...(pendingFedAdjustment !== 0
      ? [
        {
          displayValue: formatSignedAmount(pendingFedAdjustment),
          title:
                pendingFedAdjustment > 0
                  ? "Paid elsewhere"
                  : "Refunded elsewhere",
          description:
                pendingFedAdjustment > 0
                  ? `This spending counts toward this pipe, but another pipe paid for it. The next rule run will add ${formatAmount(Math.abs(pendingFedAdjustment))} to this pipe's fed balance.`
                  : `This refund reduces this pipe's spending, but another pipe received it. The next rule run will subtract ${formatAmount(Math.abs(pendingFedAdjustment))} from this pipe's fed balance.`,
          icon: "swap-horizontal-outline" as IconName,
          ref: externalRef,
          testID: "external-adjustment-chip",
          tone: "external" as const,
        },
      ]
      : []),
  ];

  return (
    <View className="flex-row flex-wrap items-center justify-center gap-1">
      {stats.map((stat) => (
        <View key={stat.title} className="items-center justify-center">
          <Pressable
            ref={stat.ref}
            testID={stat.testID}
            className={cn(
              "flex-row items-center justify-center gap-1 border p-2 rounded-md",
              stat.tone === "negative"
                ? "border-error/70 bg-error/10"
                : stat.tone === "positive"
                  ? "border-primary/70 bg-primary/10"
                : stat.tone === "growth-non-negative"
                  ? "border-secondary/70 bg-secondary/10"
                  : stat.tone === "external"
                    ? "border-accent/70 bg-accent/10"
                    : stat.tone === "warning"
                      ? "border-warning/70 bg-warning/10"
                      : "border-muted/50",
            )}
            accessibilityRole="button"
            accessibilityLabel={`${stat.title}, ${stat.displayValue}`}
            onPress={() => setSelectedStatTitle(stat.title)}
          >
            <Icon
              name={stat.icon}
              size={14}
              color={
                stat.tone === "negative"
                  ? colors.error
                  : stat.tone === "positive"
                    ? colors.primary
                  : stat.tone === "growth-non-negative"
                    ? colors.secondary
                    : stat.tone === "external"
                      ? colors.accent
                      : stat.tone === "warning"
                        ? colors.warning
                        : colors.text
              }
            />
            <Text
              className={cn(
                "text-sm",
                stat.tone === "negative"
                  ? "text-error"
                  : stat.tone === "positive"
                    ? "text-primary"
                  : stat.tone === "growth-non-negative"
                    ? "text-secondary"
                    : stat.tone === "external"
                      ? "text-accent"
                      : stat.tone === "warning"
                        ? "text-warning"
                        : "text-text",
              )}
            >
              {stat.displayValue}
            </Text>
          </Pressable>

          <Popover
            visible={selectedStatTitle === stat.title}
            onClose={() => setSelectedStatTitle(null)}
            anchorRef={stat.ref as RefObject<View>}
            anchorPosition="bottom"
          >
            <Text className="font-bold text-md text-primaryMuted mb-2">{stat.title}:</Text>
            {typeof stat.description === "string"
              ? <Text className="text-text text-sm">{stat.description}</Text>
              : stat.description}
            {stat.guidance ? <Text className="text-text text-sm mt-1">{stat.guidance}</Text> : null}
          </Popover>
        </View>
      ))}
    </View>
  );
}
