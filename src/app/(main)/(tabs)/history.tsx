import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ScreenHeader } from "@/components/ui/ScreenHeader/ScreenHeader";
import { TransactionItem } from "@/components/ui/TransactionItem";
import { usePipeSelection } from "@/features/pipes/context/PipeSelectionContext";
import { colors } from '@/lib/styles';

export default function History() {
  const { pipesById } = usePipeSelection();
  const { results, status, loadMore } = usePaginatedQuery(
    api.transactions.listTransactionsPaginated,
    {},
    { initialNumItems: 12 },
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title="History" />

      <FlatList
        className="flex-1 px-4"
        data={results}
        keyExtractor={(item) => item._id}
        onEndReached={() => loadMore(12)}
        onEndReachedThreshold={0.5}
        contentContainerClassName="gap-1 pb-4"
        ListEmptyComponent={() => {
          if (status === "LoadingFirstPage") return null;
          return (
            <View className="flex-1 items-center justify-center pt-32">
              <Text className="text-muted text-lg">Nothing has been added yet</Text>
            </View>
          );
        }}
        renderItem={({ item }) => {
          const pipe = pipesById?.[item.pipeId];
          return pipe ? (
            <TransactionItem
              key={pipe._id}
              transaction={item}
              pipeId={pipe._id}
            />
          ) :
          <Text>Error loading transaction</Text>;
        }}
        ListFooterComponent={() =>
          status === "LoadingMore" ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator
                testID="loading-indicator"
                size="small"
                color={colors.primary}
              />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
