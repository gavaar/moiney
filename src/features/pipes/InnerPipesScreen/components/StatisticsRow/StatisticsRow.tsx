import { RefObject, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Popover } from "@/components/ui/Popover";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/styles";
import { getDaysInMonth } from "@/lib/dates";

type StatItem = {
  label: string;
  value: number;
  title: string;
  description: string;
  ref: RefObject<View | null>;
};

type Props = {
  fed: number;
  spent: number;
};

export function StatisticsRow({ fed, spent }: Props) {
  const daysInMonth = getDaysInMonth();
  const [selectedStatLabel, setSelectedStatLabel] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const ellipsisRef = useRef<View>(null);
  const l2sRef = useRef<View>(null);
  const stmRef = useRef<View>(null);
  const stmpdRef = useRef<View>(null);

  const stats: StatItem[] = [
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
  ];

  return (
    <>
      <View className="flex-row self-stretch justify-center gap-1 pb-2 px-5">
        {stats.map((stat, index) => (
          <>
            {index > 0 && (<Text className="text-muted/50 text-xs">|</Text>)}

            <View key={stat.label} className="flex-row items-center">
              <Pressable ref={stat.ref} onPress={() => setSelectedStatLabel(stat.label)}>
                <Text className="text-text text-sm border border-muted/50 px-2 rounded-md">
                  {stat.label}: {stat.value.toFixed(2)}
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
          </>
        ))}

        <View className="ml-auto">
          <Pressable ref={ellipsisRef} onPress={() => setShowOptions(true)}>
            <Icon name="ellipsis-vertical" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <Popover
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        anchorRef={ellipsisRef as RefObject<View>}
        anchorPosition="left-start"
      >
        <Pressable onPress={() => console.log("edit")}>
          <Icon name="pencil-outline" size={24} color={colors.secondary} />
        </Pressable>
        <View className="h-5" />
        <Pressable onPress={() => console.log("delete")}>
          <Icon name="trash-bin-outline" size={24} color={colors.error} />
        </Pressable>
      </Popover>
    </>
  );
}
