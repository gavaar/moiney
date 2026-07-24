import { useEffect } from "react";
import { ActivityIndicator, BackHandler, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { useTransactions } from "@features/transactions/context/TransactionsContext";
import { InnerPipesScreen } from '@features/pipes/InnerPipesScreen';
import { FeedListScreen } from '@features/pipes/FeedListScreen';
import { TransactionItem } from "@ui/TransactionItem";
import { colors } from '@/lib/styles';

export default function Pipes() {
  const { feeds, isLoading, selectedName, selectedPipePath, selectPipe } = usePipeSelection();
  const { transactions, isLoading: transactionLoading } = useTransactions();

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

      <View style={{ flex: 2 }}>
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

      <View style={{ flex: 1 }}>
        <Text className="text-text font-semibold text-base my-2 px-2">Latest transactions</Text>
        <ScrollView className="flex-1 px-2">
          {transactionLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator
                testID="loading-indicator"
                size="small"
                color={colors.primary}
              />
            </View>
          ) : transactions && transactions.length > 0 ? (
            <View className="gap-1">
              {transactions.map((tx) => (
                <TransactionItem
                  key={tx._id}
                  transaction={tx}
                />
              ))}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-muted text-base">No transactions yet</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
