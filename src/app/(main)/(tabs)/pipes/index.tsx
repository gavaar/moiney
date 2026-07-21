import { useEffect, useState } from "react";
import { BackHandler, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ModalShell } from "@/components/ui/Modal";
import { ScreenHeader } from "@/components/ui/ScreenHeader/ScreenHeader";
import { usePipeSelection } from "@/features/pipes/context/PipeSelectionContext";
import { useTransactions } from "@/features/transactions/context/TransactionsContext";
import { InnerPipesScreen } from '@/features/pipes/InnerPipesScreen';
import { FeedListScreen } from '@/features/pipes/FeedListScreen';

const FeedDescription = () => (
  <Text className="text-text text-base">
    A feed is the source of money.{"\n\n"}
    When you add money, you do it to a feed, which will then cascade it down to
    your different budgets (pipes).{"\n\n"}
    The final pipes in a tree are the drains. You can only spend money from a
    drain, and you can only add money to a feed.{"\n\n"}
    This allows the feed to create budgets according to your rules, and then
    spend from these budgets.{"\n\n"}
    This helps organize money into logical buckets, and makes it easier to
    understand where your money is going.
  </Text>
);

export default function Pipes() {
  const [showFeedInfo, setShowFeedInfo] = useState(false);
  const { feeds, isLoading, selectedName, selectedPipePath, selectPipe, pipesById } = usePipeSelection();
  const { transactions } = useTransactions();

  useEffect(() => {
    const onBackPress = () => {
      if (selectedPipePath.length > 0) {
        selectPipe(selectedPipePath.slice(0, -1));
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [selectedPipePath, selectPipe]);

  return (
    <SafeAreaView className="flex-1 bg-background px-4">
      <ScreenHeader title="Pipes" />

      <View style={{ flex: 3 }}>
        {selectedName ? (
          <InnerPipesScreen />
        ) : (
          <FeedListScreen
            isLoading={isLoading}
            pipes={feeds}
            onSelectFeed={(id) => selectPipe([id])}
          />
        )}
      </View>

      <View style={{ flex: 2 }}>
        <ScrollView className="flex-1 px-2">
          {transactions && transactions.length > 0 ? (
            transactions.map((tx) => {
              const pipe = pipesById?.[tx.pipeId];
              return (
                <View
                  key={tx._id}
                  className="flex-row items-center justify-between py-3 border-b border-border"
                >
                  <View className="flex-1">
                    <Text className="text-text font-semibold" numberOfLines={1}>
                      {tx.title.charAt(0).toUpperCase() + tx.title.slice(1)}
                    </Text>
                    <Text className="text-muted text-xs">
                      {pipe?.name ?? "Unknown"} · {new Date(tx.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text
                    className={`text-base font-bold ${tx.value < 0 ? "text-red" : "text-green"}`}
                  >
                    {tx.value.toFixed(2)}
                  </Text>
                </View>
              );
            })
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-muted text-base">No transactions yet</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <ModalShell visible={showFeedInfo} onClose={() => setShowFeedInfo(false)}>
        <FeedDescription />
      </ModalShell>
    </SafeAreaView>
  );
}
