import { useEffect, useState } from "react";
import { BackHandler, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { SlideToggle } from "@ui/SlideToggle";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { useTransactions } from "@features/transactions/context/TransactionsContext";
import { InnerPipesScreen } from "@features/pipes/InnerPipesScreen";
import { PipeTreeView } from "@features/pipes/PipeTreeView";
import { FeedListScreen } from "@features/pipes/FeedListScreen";
import { TransactionList } from "@ui/TransactionList";

export default function Pipes() {
  const [treeMode, setTreeMode] = useState(false);
  const { feeds, isLoading, selectedName, selectedPipePath, selectPipe, deselectPipe } = usePipeSelection();
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
      <ScreenHeader
        title="Pipes"
        right={
          <SlideToggle
            options={[
              { value: "bar", icon: "align-horizontal-left" },
              { value: "tree", icon: "file-tree" },
            ]}
            value={treeMode ? "tree" : "bar"}
            onChange={(v) => {
              setTreeMode(v === "tree");
              if (v === "tree") deselectPipe();
            }}
          />
        }
      />

      <View style={{ flex: 2 }}>
        {treeMode ? (
          <PipeTreeView
            onSelectPipe={(path) => {
              selectPipe(path);
              setTreeMode(false);
            }}
          />
        ) : selectedName ? (
          <InnerPipesScreen />
        ) : (
          <FeedListScreen
            isLoading={isLoading}
            pipes={feeds}
            onSelectFeed={(id) => selectPipe([id])}
          />
        )}
      </View>

      {!treeMode && (
        <View style={{ flex: 1 }}>
          <Text className="text-text font-semibold text-base my-2 px-2">Latest transactions</Text>
          <TransactionList
            transactions={transactions}
            isLoading={transactionLoading}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
