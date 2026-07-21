import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ScreenHeader } from "@/components/ui/ScreenHeader/ScreenHeader";
import { usePipeSelection } from "@/features/pipes/context/PipeSelectionContext";

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
          return (
            <View className="flex-row items-center justify-between py-4 border-b border-border">
              <View className="flex-1">
                <Text className="text-text font-semibold" numberOfLines={1}>
                  {item.title.charAt(0).toUpperCase() + item.title.slice(1)}
                </Text>
                <Text className="text-muted text-xs mt-1">
                  {pipe?.name ?? "Unknown"} · {new Date(item.date).toLocaleDateString()}
                </Text>
              </View>
              <Text
                className={`text-base font-bold ${item.value < 0 ? "text-red" : "text-green"}`}
              >
                {item.value.toFixed(2)}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={() =>
          status === "LoadingMore" ? (
            <View className="py-4 items-center">
              <Text className="text-muted text-sm">Loading more...</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
