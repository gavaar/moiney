import { usePaginatedQuery } from "convex/react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { api } from "@convex/_generated/api";
import { Button } from "@ui/Button";
import { ModalShell } from "@ui/Modal";
import { formatAmount } from "@/lib/format";
import { colors } from "@/lib/styles";
import type { TransactionModel } from "@features/transactions/data/transactions";

type Props = {
  visible: boolean;
  transactionId: TransactionModel["id"];
  transactionTitle: string;
  onClose: () => void;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", DATE_FORMAT);
}

function displayTitle(title: string): string {
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function TransactionCorrectionHistoryModal({
  visible,
  transactionId,
  transactionTitle,
  onClose,
}: Props) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.transactions.listTransactionCorrectionsPaginated,
    { transactionId },
    { initialNumItems: 20 },
  );

  return (
    <ModalShell visible={visible} onClose={onClose}>
      <View className="gap-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-text text-lg font-bold">Edit history</Text>
            <Text className="text-muted text-sm" numberOfLines={1}>
              {displayTitle(transactionTitle)}
            </Text>
          </View>
        </View>

        {status === "LoadingFirstPage" ? (
          <View className="items-center py-8">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : results.length === 0 ? (
          <Text className="text-muted">No edit history available.</Text>
        ) : (
          <ScrollView className="max-h-96" contentContainerClassName="gap-3">
            {results.map((correction) => (
              <View
                key={correction.correctionId}
                className="gap-2 rounded-xl border border-border bg-background p-3"
              >
                <Text className="text-muted text-xs">
                  {formatDate(correction.editedAt)}
                </Text>

                {correction.previous.value !== correction.current.value ? (
                  <View>
                    <Text className="text-text text-sm font-semibold">Amount changed</Text>
                    <Text className="text-muted text-sm">
                      {formatAmount(correction.previous.value)} → {formatAmount(correction.current.value)}
                    </Text>
                  </View>
                ) : null}

                {correction.previous.title !== correction.current.title ? (
                  <View>
                    <Text className="text-text text-sm font-semibold">Title changed</Text>
                    <Text className="text-muted text-sm">
                      {displayTitle(correction.previous.title)} → {displayTitle(correction.current.title)}
                    </Text>
                  </View>
                ) : null}

                {correction.previous.date !== correction.current.date ? (
                  <View>
                    <Text className="text-text text-sm font-semibold">Date changed</Text>
                    <Text className="text-muted text-sm">
                      {formatDate(correction.previous.date)} → {formatDate(correction.current.date)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}

        {status === "CanLoadMore" ? (
          <Button title="Load older edits" variant="secondary" onPress={() => loadMore(20)} />
        ) : null}
      </View>
    </ModalShell>
  );
}
