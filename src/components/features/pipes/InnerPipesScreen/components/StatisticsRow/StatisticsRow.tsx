import { Fragment, RefObject, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Popover } from "@ui/Popover";
import { Icon, type IconName } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { getDaysInMonth } from "@/lib/dates";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";

const DAY_MS = 24 * 60 * 60 * 1000;

type StatItem = {
  label: string;
  value: number;
  title: string;
  description: string;
  ref: RefObject<View | null>;
  icon?: IconName;
  external?: boolean;
};

type Props = {
  fed: number;
  spent: number;
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
  pendingFedAdjustment = 0,
  sourceType,
  contributedFed = 0,
}: Props) {
  const daysInMonth = getDaysInMonth();
  const [selectedStatLabel, setSelectedStatLabel] = useState<string | null>(
    null,
  );
  const l2sRef = useRef<View>(null);
  const stmRef = useRef<View>(null);
  const stmpdRef = useRef<View>(null);
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
      {
        label: "L2S",
        value: fed - spent,
        title: "Left to spend (L2S)",
        description: "How much left can be spent from this pipe at the moment",
        ref: l2sRef,
      },
      {
        label: "StM",
        value: spent,
        title: "Spent this month (StM)",
        description: "How much have been spent this month",
        ref: stmRef,
      },
      {
        label: "StMpD",
        value: daysInMonth > 0 ? spent / daysInMonth : 0,
        title: "Spent this month per day (StMpD)",
        description:
          "An average of how much was spent per day in this pipe, this month",
        ref: stmpdRef,
      },
      ...(daysLeft != null
        ? [
            {
              label: "DL",
              value: daysLeft,
              title: "Days left (DL)",
              description: "Days left until this pipe resets",
              icon: "timer-outline" as IconName,
              ref: cronRef,
            },
          ]
        : []),
      ...(pendingFedAdjustment !== 0
        ? [
            {
              label: "Ext",
              value: pendingFedAdjustment,
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
              external: true,
            },
          ]
        : []),
    ],
    [fed, spent, daysInMonth, daysLeft, pendingFedAdjustment],
  );

  const primaryStats = stats.filter((stat) => !stat.external);
  const externalStat = stats.find((stat) => stat.external);
  const growth =
    sourceType === "boiler" && contributedFed !== 0
      ? ((fed - contributedFed) / contributedFed) * 100
      : null;
  const growthLabel = growth === null ? "N/A" : formatGrowthPercentage(growth);

  return (
    <View className="items-center gap-1">
      <View className="flex-row justify-center gap-1">
        {primaryStats.map((stat, index) => (
          <Fragment key={stat.label}>
            {index > 0 && <Text className="text-muted/50 text-xs">|</Text>}

            <View className="flex-row items-center">
              <Pressable
                ref={stat.ref}
                accessibilityRole="button"
                onPress={() => setSelectedStatLabel(stat.label)}
              >
                <Text className="text-sm border px-2 rounded-md border-muted/50 text-text">
                  {stat.icon ? (
                    <>
                      <Icon name={stat.icon} size={14} color={colors.text} />
                      <Text> {stat.value}</Text>
                    </>
                  ) : (
                    <>
                      {stat.label}: {formatAmount(Math.round(stat.value))}
                    </>
                  )}
                </Text>
              </Pressable>

              <Popover
                visible={selectedStatLabel === stat.label}
                onClose={() => setSelectedStatLabel(null)}
                anchorRef={stat.ref as RefObject<View>}
                anchorPosition="bottom"
              >
                <Text className="text-text font-bold text-md">
                  {stat.title}:
                </Text>
                <Text className="text-text text-sm">{stat.description}</Text>
              </Popover>
            </View>
          </Fragment>
        ))}
      </View>

      {sourceType === "boiler" ? (
        <View className="flex-row items-center">
          <Pressable
            ref={growthRef}
            accessibilityRole="button"
            accessibilityLabel={`Boiler growth, ${
              growth !== null && growth < 0 ? "negative" : "non-negative"
            }`}
            onPress={() => setSelectedStatLabel("Growth")}
          >
            <Text
              testID="boiler-growth-chip"
              className={`text-sm border px-2 rounded-md ${
                growth !== null && growth < 0
                  ? "border-error/70 bg-error/10 text-error"
                  : "border-secondary/70 bg-secondary/10 text-secondary"
              }`}
            >
              Growth: {growthLabel}
            </Text>
          </Pressable>

          <Popover
            visible={selectedStatLabel === "Growth"}
            onClose={() => setSelectedStatLabel(null)}
            anchorRef={growthRef as RefObject<View>}
            anchorPosition="bottom"
          >
            <Text className="text-text font-bold text-md">Growth:</Text>
            <Text className="text-text text-sm">
              This pipe has received {formatAmount(contributedFed)} value, but now holds {formatAmount(fed)}, meaning it has grown {growthLabel}.
            </Text>
          </Popover>
        </View>
      ) : null}

      {externalStat ? (
        <View className="flex-row items-center">
          <Pressable
            ref={externalStat.ref}
            testID="external-adjustment-chip"
            accessibilityRole="button"
            accessibilityLabel={externalStat.title}
            onPress={() => setSelectedStatLabel(externalStat.label)}
          >
            <Text className="text-sm border px-2 rounded-md border-accent/70 bg-accent/10 text-accent">
              <Icon name={externalStat.icon!} size={14} color={colors.accent} />
              <Text> {formatSignedAmount(externalStat.value)}</Text>
            </Text>
          </Pressable>

          <Popover
            visible={selectedStatLabel === externalStat.label}
            onClose={() => setSelectedStatLabel(null)}
            anchorRef={externalStat.ref as RefObject<View>}
            anchorPosition="bottom"
          >
            <Text className="text-text font-bold text-md">
              {externalStat.title}:
            </Text>
            <Text className="text-text text-sm">
              {externalStat.description}
            </Text>
          </Popover>
        </View>
      ) : null}
    </View>
  );
}
