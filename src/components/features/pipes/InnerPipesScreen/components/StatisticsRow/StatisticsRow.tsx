import { type ReactNode, RefObject, useRef, useState } from "react";
import { Pressable, Text, useWindowDimensions, View, type ViewInstance } from "react-native";
import { Popover } from "@ui/Popover";
import { Icon, type IconName } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { prepareContingencyPreview } from "@features/pipes/data/contingencyPreview";
import { RemainingExpectedDetails } from "./RemainingExpectedDetails";
import { CoverageDetails, CoverageProvidedDetails } from "./CoverageDetails";
import { monthlySpendingPace } from "@domain/statistics/monthlySpendingPace";
import { monthlyAllowance } from "@domain/statistics/monthlyAllowance";

const DAY_MS = 24 * 60 * 60 * 1000;
const GRID_GAP = 8;

type StatItem = {
  displayValue: string;
  estimated?: boolean;
  title: string;
  description: ReactNode;
  guidance?: string;
  ref: RefObject<ViewInstance | null>;
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
  const { fontScale } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(0);
  const pace = monthlySpent === undefined ? undefined : monthlySpendingPace(monthlySpent, now);
  const allowance = monthlySpent === undefined ? undefined : monthlyAllowance(expected, monthlySpent, now);
  const growth =
    sourceType === "boiler" && contributedFed !== 0
      ? ((fed - contributedFed) / contributedFed) * 100
      : null;
  const growthLabel = growth === null ? "N/A" : formatGrowthPercentage(growth);
  const [selectedStatTitle, setSelectedStatTitle] = useState<string | null>(
    null,
  );
  const remainingExpectedRef = useRef<ViewInstance>(null);
  const stmpdRef = useRef<ViewInstance>(null);
  const astmRef = useRef<ViewInstance>(null);
  const cronRef = useRef<ViewInstance>(null);
  const externalRef = useRef<ViewInstance>(null);
  const growthRef = useRef<ViewInstance>(null);
  const coverageRef = useRef<ViewInstance>(null);
  const coverageProvidedRef = useRef<ViewInstance>(null);
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
      displayValue: allowance === undefined ? "Loading" : formatAmount(Math.round(allowance.accumulatedSpend)),
      title: "Accumulated spend this month",
      tone: allowance === undefined ? undefined : allowance.accumulatedSpend < 0 ? "negative" : "positive",
      description: allowance !== undefined && monthlySpent !== undefined ? (
        <View className="gap-2">
          <Text className="text-text text-sm">
            This month’s expected spending is <Text className="text-secondary">{formatAmount(expected)}</Text>,
            {" or "}<Text className="text-secondary">{formatAmount(Math.round(allowance.dailyExpected))}</Text> per day.
          </Text>
          <Text className="text-text text-sm">
            Adding up to today, that gives you an allowance of{" "}
            <Text className="text-primary">{formatAmount(Math.round(allowance.accruedAllowance))}</Text>.
          </Text>
          <Text className="text-text text-sm">
            You’ve spent <Text className="text-errorMuted">{formatAmount(monthlySpent)}</Text> this month,
            {" leaving an accumulated allowance of "}
            <Text className={allowance.accumulatedSpend < 0 ? "text-error" : "text-primary"}>
              {formatAmount(Math.round(allowance.accumulatedSpend))}
            </Text>.
          </Text>
        </View>
      ) : <Text className="text-muted text-sm">Loading monthly spending…</Text>,
      guidance: allowance?.recovery.status === "recovering"
        ? `Assuming no further spending, this value will be positive again in ${allowance.recovery.days} ${allowance.recovery.days === 1 ? "day" : "days"}.`
        : allowance?.recovery.status === "exhausted"
          ? "You’ve used up this month’s allowance. Avoid further spending this month."
          : undefined,
      icon: "playlist-add",
      ref: astmRef,
    },
    ...(pendingFedAdjustment !== 0
      ? [
        {
          displayValue: formatSignedAmount(pendingFedAdjustment),
          title:
                pendingFedAdjustment > 0
                  ? "Paid elsewhere"
                  : "Refunded elsewhere",
          description: (
            <View className="gap-2">
              <Text className="text-text text-sm">
                {pendingFedAdjustment > 0
                  ? "Expenses were added and counted towards this pipe’s spending budget, but actual funding was taken from somewhere else."
                  : "Refunds were added and reduced this pipe’s spending, but actual funding was received somewhere else."}
              </Text>
              <Text className="text-text text-sm">
                This pipe’s funding will be {pendingFedAdjustment > 0 ? "increased" : "decreased"} at next settlement by{" "}
                <Text className="text-accent">{formatAmount(Math.abs(pendingFedAdjustment))}</Text>.
              </Text>
            </View>
          ),
          icon: "swap-horizontal-outline" as IconName,
          ref: externalRef,
          testID: "external-adjustment-chip",
          tone: "external" as const,
        },
      ]
      : []),
    ...(coverageProvided && currentPipe ? [
      {
        displayValue: formatAmount(coverageProvided.amountCents),
        title: "Possible coverage provided",
        estimated: true,
        tone: "warning" as const,
        description: <CoverageProvidedDetails donor={currentPipe} allocations={coverageProvided.allocations} amountCents={coverageProvided.amountCents} />,
        icon: "shield" as IconName,
        ref: coverageProvidedRef,
      }
    ] : []),
    ...(coverage && currentPipe ? [
      {
        displayValue: formatAmount(coverage.amountCents),
        title: "Possible coverage",
        estimated: true,
        tone: "warning" as const,
        description: <CoverageDetails source={currentPipe} donor={coverage.donor} amountCents={coverage.amountCents} />,
        icon: "shield" as IconName,
        ref: coverageRef,
      }
    ] : []),
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
  ];

  // Reserve room for the icon, padding, and the longest amount without shrinking text.
  let longestValueLength = 0;
  for (const { displayValue, estimated } of stats) {
    longestValueLength = Math.max(longestValueLength, displayValue.length + (estimated ? 2 : 0));
  }
  const minPillWidth = Math.max(96, 36 + longestValueLength * 8 * fontScale);
  const columns = Math.max(2, Math.min(
    fontScale <= 1.2 ? 4 : 2,
    Math.floor((gridWidth + GRID_GAP) / (minPillWidth + GRID_GAP)),
  ));

  return (
    <View
      className="flex-row flex-wrap items-stretch justify-start"
      style={{ columnGap: GRID_GAP, rowGap: 4 }}
      onLayout={({ nativeEvent }) => setGridWidth(nativeEvent.layout.width)}
    >
      {stats.map((stat) => (
        <View
          key={stat.title}
          style={{ width: gridWidth > 0 ? Math.max(0, (gridWidth - GRID_GAP * (columns - 1)) / columns) : "48%" }}
        >
          <Pressable
            ref={stat.ref}
            testID={stat.testID}
            className={cn(
              "grow flex-row items-center justify-center gap-1 border px-2 py-1 rounded-md min-h-8",
              stat.tone === "negative"
                 ? "border-errorMuted/40 bg-errorMuted/5"
                : stat.tone === "positive"
                   ? "border-primaryMuted/40 bg-primaryMuted/5"
                : stat.tone === "growth-non-negative"
                   ? "border-secondarySoft/40 bg-secondarySoft/5"
                  : stat.tone === "external"
                     ? "border-accentMuted/40 bg-accentMuted/5"
                    : stat.tone === "warning"
                       ? "border-warningSoft/40 bg-warningSoft/5"
                      : "border-muted/50",
            )}
            accessibilityRole="button"
            accessibilityLabel={`${stat.title}, ${stat.displayValue}${stat.estimated ? ", estimated" : ""}`}
            onPress={() => setSelectedStatTitle(stat.title)}
          >
            <Icon
              name={stat.icon}
              size={14}
              color={
                stat.tone === "negative"
                   ? colors.errorMuted
                  : stat.tone === "positive"
                     ? colors.primaryMuted
                  : stat.tone === "growth-non-negative"
                     ? colors.secondarySoft
                    : stat.tone === "external"
                       ? colors.accentMuted
                      : stat.tone === "warning"
                         ? colors.warningSoft
                        : colors.text
              }
            />
            <Text
              className={cn(
                "text-sm shrink",
                stat.tone === "negative"
                   ? "text-errorMuted"
                  : stat.tone === "positive"
                     ? "text-primaryMuted"
                  : stat.tone === "growth-non-negative"
                     ? "text-secondarySoft"
                    : stat.tone === "external"
                       ? "text-accentMuted"
                      : stat.tone === "warning"
                         ? "text-warningSoft"
                        : "text-text",
              )}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {stat.displayValue}
              {stat.estimated ? <Text className="text-muted text-sm"> ?</Text> : null}
            </Text>
          </Pressable>

          <Popover
            visible={selectedStatTitle === stat.title}
            onClose={() => setSelectedStatTitle(null)}
            anchorRef={stat.ref}
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
