import { RefObject, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Popover } from "@ui/Popover";
import { Icon, type IconName } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { getDaysInMonth } from "@/lib/dates";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";

const DAY_MS = 24 * 60 * 60 * 1000;

type StatItem = {
  displayValue: string;
  title: string;
  description: string;
  guidance?: string;
  ref: RefObject<View | null>;
  icon: IconName;
  testID?: string;
  tone?: "external" | "growth-negative" | "growth-non-negative";
};

type Props = {
  fed: number;
  spent: number;
  capacity: number;
  expected: number;
  pendingFedAdjustment?: number;
  sourceType?: "feed" | "boiler";
  contributedFed?: number;
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
  capacity,
  expected,
  pendingFedAdjustment = 0,
  sourceType,
  contributedFed = 0,
}: Props) {
  const daysInMonth = getDaysInMonth();
  const currentDay = new Date().getDate();
  const dailyExpected = daysInMonth > 0 ? expected / daysInMonth : 0;
  const accumulatedSpend = dailyExpected * currentDay - spent;
  const daysUntilPositive =
    accumulatedSpend < 0 && dailyExpected > 0
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
  const l2sRef = useRef<View>(null);
  const stmpdRef = useRef<View>(null);
  const astmRef = useRef<View>(null);
  const cronRef = useRef<View>(null);
  const externalRef = useRef<View>(null);
  const growthRef = useRef<View>(null);
  const { selectedPipePath } = usePipeSelection();
  const { pipesById } = usePipeCatalog();

  const selectedId =
    selectedPipePath.length > 0
      ? selectedPipePath[selectedPipePath.length - 1]
      : null;
  const currentPipe = selectedId && pipesById ? pipesById[selectedId] : null;

  const daysLeft =
    currentPipe?.rule === "cron" && currentPipe.cronNextDate != null
      ? Math.max(0, Math.ceil((currentPipe.cronNextDate - Date.now()) / DAY_MS))
      : null;

  const stats = useMemo<StatItem[]>(
    () => [
      ...(sourceType !== "boiler"
        ? [
            {
              displayValue: formatAmount(capacity - spent),
              title: "Left to spend",
              description: `You have ${formatAmount(capacity - spent)} left to spend from this pipe at the moment.`,
              icon: "circle-half-full" as IconName,
              ref: l2sRef,
            },
          ]
        : []),
      {
        displayValue: formatAmount(Math.round(spent / currentDay)),
        title: "Spent this month per day",
        description: `An average of ${formatAmount(Math.round(spent / currentDay))} was spent per day over ${currentDay} days in this pipe this month.`,
        icon: "calculate",
        ref: stmpdRef,
      },
      {
        displayValue: formatAmount(Math.round(accumulatedSpend)),
        title: "Accumulated spend this month",
        description: `You can spend ${formatAmount(Math.round(accumulatedSpend))}. This month expects ${formatAmount(expected)} to be spent, which adds up to ${formatAmount(Math.round(dailyExpected))} spendable per day. Given you have already spent ${formatAmount(spent)}, you can spend up to today ${formatAmount(Math.round(accumulatedSpend))}.`,
        guidance: accumulatedSpend < 0
          ? daysUntilPositive !== null &&
            daysUntilPositive <= daysInMonth - currentDay
            ? `This value will be positive again in ${daysUntilPositive} ${daysUntilPositive === 1 ? "day" : "days"}.`
            : "You should not spend anymore from this pipe this month."
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
                  ? ("growth-negative" as const)
                  : ("growth-non-negative" as const),
            },
          ]
        : []),
      ...(daysLeft != null
        ? [
            {
              displayValue: String(daysLeft),
              title: "Days left",
              description: "Days left until this pipe resets",
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
    ],
    [
      accumulatedSpend,
      capacity,
      currentDay,
      dailyExpected,
      daysLeft,
      expected,
      fed,
      contributedFed,
      growth,
      growthLabel,
      pendingFedAdjustment,
      sourceType,
      spent,
    ],
  );

  return (
    <View className="flex-row flex-wrap items-center justify-center gap-1">
      {stats.map((stat) => (
        <View key={stat.title} className="items-center justify-center">
          <Pressable
            ref={stat.ref}
            testID={stat.testID}
            className={cn(
              "flex-row items-center justify-center gap-1 border p-2 rounded-md",
              stat.tone === "growth-negative"
                ? "border-error/70 bg-error/10"
                : stat.tone === "growth-non-negative"
                  ? "border-secondary/70 bg-secondary/10"
                  : stat.tone === "external"
                    ? "border-accent/70 bg-accent/10"
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
                stat.tone === "growth-negative"
                  ? colors.error
                  : stat.tone === "growth-non-negative"
                    ? colors.secondary
                    : stat.tone === "external"
                      ? colors.accent
                      : colors.text
              }
            />
            <Text
              className={cn(
                "text-sm",
                stat.tone === "growth-negative"
                  ? "text-error"
                  : stat.tone === "growth-non-negative"
                    ? "text-secondary"
                    : stat.tone === "external"
                      ? "text-accent"
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
            <Text className="text-text font-bold text-md">{stat.title}:</Text>
            <Text className="text-text text-sm">{stat.description}</Text>
            {stat.guidance ? <Text className="text-text text-sm mt-1">{stat.guidance}</Text> : null}
          </Popover>
        </View>
      ))}
    </View>
  );
}
