import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { TransactionItem } from "@ui/TransactionItem";
import { colors } from '@/lib/styles';

export default function History() {
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
        renderItem={({ item }) => (
          <TransactionItem
            key={item._id}
            transaction={item}
          />
        )}
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
