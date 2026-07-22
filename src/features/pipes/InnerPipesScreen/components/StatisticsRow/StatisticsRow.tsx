import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ModalShell } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/styles";
import { getDaysInMonth } from "@/lib/dates";

type StatItem = {
  label: string;
  value: number;
  title: string;
  description: string;
};

type Props = {
  fed: number;
  spent: number;
};

export function StatisticsRow({ fed, spent }: Props) {
  const daysInMonth = getDaysInMonth();
  const [modalInfo, setModalInfo] = useState<StatItem | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const stats: StatItem[] = [
    {
      label: "L2S",
      value: fed - spent,
      title: "Left to spend (L2S)",
      description: "How much left can be spent from this pipe at the moment",
    },
    {
      label: "StM",
      value: spent,
      title: "Spent this month (StM)",
      description: "How much have been spent this month",
    },
    {
      label: "StMpD",
      value: daysInMonth > 0 ? spent / daysInMonth : 0,
      title: "Spent this month per day (StMpD)",
      description: "An average of how much was spent per day in this pipe, this month",
    },
  ];

  return (
    <>
      <View className="flex-row self-stretch justify-center gap-1 pb-2">
        {stats.map((stat, index) => (
          <>
            {index > 0 && (<Text className="text-muted/50 text-xs">|</Text>)}

            <View key={stat.label} className="flex-row items-center">
              <Pressable onPress={() => setModalInfo(stat)}>
                <Text className="text-text text-sm border border-muted/50 px-2 rounded-md">
                  {stat.label}: {stat.value.toFixed(2)}
                </Text>
              </Pressable>
            </View>
          </>
        ))}

        <View className="ml-auto">
          <Pressable onPress={() => setShowOptionsModal(true)}>
            <Icon name="ellipsis-vertical" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <ModalShell
        visible={modalInfo !== null}
        onClose={() => setModalInfo(null)}
      >
        <Text className="text-text font-bold text-md">{modalInfo?.title}:</Text>
        <Text className="text-text text-sm">{modalInfo?.description}</Text>
      </ModalShell>

      <ModalShell
        visible={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
      >
        <Text className="text-text text-sm">options modal</Text>
      </ModalShell>
    </>
  );
}
