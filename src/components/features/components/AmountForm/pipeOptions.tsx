import { Text, View } from "react-native";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { Icon, safeIconName } from "@ui/Icon";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { InputProps } from "@ui/Input";

export function getTransactionPipeColor(pipe?: Pick<PipeModel, "spent" | "fed">) {
  return !pipe ? colors.muted : pipe.spent >= pipe.fed ? colors.error : colors.text;
}

export function transactionPipeItems(
  items: readonly { id: string; name: string; icon: string }[],
  pipesById: Readonly<Record<string, PipeModel>>,
  showSummary = false,
) {
  return items.map(item => {
    const pipe = pipesById[item.id];
    return {
      ...item,
      color: getTransactionPipeColor(pipe),
      summary: showSummary && pipe ? ` (${formatAmount(pipe.spent)} / ${formatAmount(pipe.capacity)})` : "",
    };
  });
}

type Item = Extract<InputProps, { type: "select" }>["items"][number];

export function renderTransactionPipe(item: Item) {
  return <View className="flex-row items-center gap-2">
    <Icon name={safeIconName(item.icon)} size={22} color={item.color} />
    <Text className="flex-1 text-text" numberOfLines={1}>{item.name}{item.summary}</Text>
  </View>;
}

export function transactionPipeStyle(item: Item) {
  return { borderColor: item.color };
}
