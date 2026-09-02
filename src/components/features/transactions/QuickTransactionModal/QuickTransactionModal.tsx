import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { AmountForm } from "@features/components/AmountForm";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { PipeModel } from "@features/pipes/data/pipes";
import { useTransactionHistory } from "@features/transactions/cache/useTransactionHistory";
import { Icon, safeIconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { formatAmount } from "@/lib/format";
import { cn, colors } from "@/lib/styles";
import {
  getFrequentlyUsedSourcePipeIds,
  getQuickTransactionPipes,
} from "./helpers";

type Props = {
  onClose: () => void;
};

export function QuickTransactionModal({ onClose }: Props) {
  const { allPipes, childrenByParent, isLoading: pipesLoading } = usePipeCatalog();
  const { transactions, isLoading: historyLoading } = useTransactionHistory();
  const [selectedPipe, setSelectedPipe] = useState<PipeModel | null>(null);
  const frequentlyUsedPipeIds = getFrequentlyUsedSourcePipeIds(transactions ?? []);
  const pipes = getQuickTransactionPipes(
    allPipes ?? [],
    childrenByParent,
    frequentlyUsedPipeIds ?? [],
  );

  return (
    <ModalShell visible onClose={onClose}>
      {selectedPipe ? (
        <ScrollView keyboardShouldPersistTaps="handled">
          <AmountForm
            pipeId={selectedPipe.id}
            variant="transaction"
            initState={{
              pipeIcon: selectedPipe.icon,
              pipeName: selectedPipe.name,
              spent: selectedPipe.spent,
              capacity: selectedPipe.capacity,
              title: "",
              value: "-",
              structure: { type: "expense", from: selectedPipe.id },
              intent: "create",
            }}
            onSuccess={onClose}
          />
        </ScrollView>
      ) : (
        <View className="gap-3">
          <Text accessibilityRole="header" className="text-lg font-semibold text-text">
            Create transaction
          </Text>
          {pipesLoading || historyLoading ? (
            <ActivityIndicator accessibilityLabel="Loading transaction pipes" />
          ) : (
            <FlatList
              data={pipes}
              keyExtractor={(pipe) => pipe.id}
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ gap: 8 }}
              ListEmptyComponent={
                <Text className="py-4 text-center text-muted">
                  No pipes can create transactions
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Create transaction from ${item.name}`}
                  onPress={() => setSelectedPipe(item)}
                  className={cn(
                    "flex-row items-center gap-2 rounded-xl border bg-background p-3",
                    item.spent < item.capacity
                      ? "border-success"
                      : "border-error",
                  )}
                >
                  <Icon
                    name={safeIconName(item.icon)}
                    size={22}
                    color={colors.muted}
                  />
                  <Text className="flex-1 text-text" numberOfLines={1}>
                    {item.name} ({formatAmount(item.spent)} / {formatAmount(item.capacity)})
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </ModalShell>
  );
}
