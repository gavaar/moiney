import { Pressable, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { cn, colors } from "@/lib/styles";
import type { TransactionGroup } from "@features/transactions/groupTransactions";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { formatAmount } from "@/lib/format";
import { getStackedTransactionItemModel } from "./stackedTransactionItem.model";

type StackedTransactionItemProps = {
  group: TransactionGroup;
  expanded: boolean;
  onToggle: () => void;
};

export function StackedTransactionItem({
  group,
  expanded,
  onToggle,
}: StackedTransactionItemProps) {
  const catalog = usePipeCatalog();
  const model = getStackedTransactionItemModel(group, catalog);

  return (
    <View
      testID="transaction-group-row"
      className="flex-row gap-1"
    >
      <Pressable
        testID="transaction-group-disclosure"
        className={cn(
          "self-stretch rounded-full border border-border px-2 flex-row items-center justify-center gap-0.5",
          model.bgClass,
        )}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${group.count} transactions`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
      >
        <View
          style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
        >
          <Icon name="chevron-down" size={12} color={colors.muted} />
        </View>
        <Text className="text-muted text-xs font-bold">x{group.count}</Text>
      </Pressable>

      <Pressable
        testID="transaction-group-main"
        className={cn(
          "flex-1 flex-row gap-1 items-center rounded-2xl border border-border px-2 py-2",
          model.bgClass,
        )}
        onPress={onToggle}
      >
        <Icon
          name={model.groupIconName}
          size={16}
          color={model.groupIconColor}
        />

        <Text
          className="font-bold text-sm text-text flex-1 ml-0.5"
          numberOfLines={1}
        >
          {group.title.charAt(0).toUpperCase() + group.title.slice(1)}
        </Text>

        <View className="flex-row items-center gap-1 mr-3">
          <Text className="text-xs text-text">
            {model.dateRange}
          </Text>
        </View>

        <Text className="text-sm font-bold w-16 text-right text-text">
          {formatAmount(group.totalValue)}
        </Text>
      </Pressable>
    </View>
  );
}
