import { Fragment, RefObject, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Popover } from "@ui/Popover";
import { Icon, type IconName } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { getDaysInMonth } from "@/lib/dates";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";

const DAY_MS = 24 * 60 * 60 * 1000;

type StatItem = {
  label: string;
  value: number;
  title: string;
  description: string;
  ref: RefObject<View | null>;
  icon?: IconName;
};

type Props = {
  fed: number;
  spent: number;
};

export function StatisticsRow({ fed, spent }: Props) {
  const daysInMonth = getDaysInMonth();
  const [selectedStatLabel, setSelectedStatLabel] = useState<string | null>(null);
  const l2sRef = useRef<View>(null);
  const stmRef = useRef<View>(null);
  const stmpdRef = useRef<View>(null);
  const cronRef = useRef<View>(null);
  const { selectedPipePath, pipesById } = usePipeSelection();

  const selectedId = selectedPipePath.length > 0
    ? selectedPipePath[selectedPipePath.length - 1]
    : null;
  const currentPipe = selectedId && pipesById ? pipesById[selectedId] : null;

  const daysLeft =
    currentPipe?.rule === "cron" && currentPipe.cronNextDate != null
      ? Math.max(0, Math.ceil((currentPipe.cronNextDate - Date.now()) / DAY_MS))
      : null;

  const stats = useMemo<StatItem[]>(() => [
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
      description: "An average of how much was spent per day in this pipe, this month",
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
  ], [fed, spent, daysInMonth, daysLeft]);

  return (
    <View className="flex-row justify-center gap-1">
      {stats.map((stat, index) => (
        <Fragment key={stat.label}>
          {index > 0 && (<Text className="text-muted/50 text-xs">|</Text>)}

          <View className="flex-row items-center">
            <Pressable ref={stat.ref} onPress={() => setSelectedStatLabel(stat.label)}>
              <Text className="text-sm border px-2 rounded-md border-muted/50 text-text">
                {stat.icon ? (
                  <>
                    <Icon name={stat.icon} size={14} color={colors.text} />
                    <Text> {stat.value}</Text>
                  </>
                ) : (
                  <>
                    {stat.label}: {formatAmount(stat.value)}
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
              <Text className="text-text font-bold text-md">{stats[index].title}:</Text>
              <Text className="text-text text-sm">{stats[index].description}</Text>
            </Popover>
          </View>
        </Fragment>
      ))}
    </View>
  );
}
