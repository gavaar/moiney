import { useCallback, useEffect, useState } from "react";
import { BackHandler, Pressable, Text } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@ui/ScreenHeader/ScreenHeader";
import { SlideToggle } from "@ui/SlideToggle";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { useTransactions } from "@features/transactions/context/TransactionsContext";
import { InnerPipesScreen } from "@features/pipes/InnerPipesScreen";
import { PipeTreeView } from "@features/pipes/PipeTreeView";
import { FeedListScreen } from "@features/pipes/FeedListScreen";
import { TransactionListWithHistory } from "@features/transactions/TransactionListWithHistory";

export function PipesScreen() {
  const [treeMode, setTreeMode] = useState(false);
  const [latestExpanded, setLatestExpanded] = useState(true);
  const open = useSharedValue(1);
  const { selectedName, selectedPipePath, selectPipe, deselectPipe } = usePipeSelection();
  const { feeds, isLoading } = usePipeCatalog();
  const {
    transactions,
    isLoading: transactionLoading,
    pipeIds,
    refresh: refreshTransactions,
  } = useTransactions();

  useEffect(() => {
    open.value = withTiming(latestExpanded ? 1 : 0, { duration: 220 });
  }, [latestExpanded, open]);

  useEffect(() => {
    setLatestExpanded(!treeMode);
  }, [treeMode]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${open.value * 180}deg` }],
  }));

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (selectedPipePath.length > 0) {
          selectPipe(selectedPipePath.slice(0, -1));
          return true;
        }
        return false;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [selectedPipePath, selectPipe]),
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background px-4 pb-1">
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

      <Animated.View
        style={{ flex: 2 }}
        layout={LinearTransition.duration(220)}
      >
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
      </Animated.View>

      <Animated.View
        layout={LinearTransition.duration(220)}
        style={{ flex: latestExpanded ? 1 : 0, overflow: "hidden" }}
      >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              latestExpanded
                ? "Collapse latest transactions"
                : "Expand latest transactions"
            }
            accessibilityState={{ expanded: latestExpanded }}
            onPress={() => setLatestExpanded((v) => !v)}
            className="flex-row items-center justify-between bg-surface px-3 py-2 my-2 rounded-md"
          >
            <Text className="text-text font-semibold text-base">
              Latest transactions
            </Text>
            <Animated.View style={chevronStyle}>
              <Icon name="chevron-up" size={18} color={colors.text} />
            </Animated.View>
          </Pressable>
          {latestExpanded ? (
            <Animated.View
              className="flex-1"
              entering={FadeInDown.duration(220)}
              exiting={FadeOutUp.duration(220)}
            >
              <TransactionListWithHistory
                transactions={transactions}
                isLoading={transactionLoading}
                onRefresh={refreshTransactions}
                refreshing={transactionLoading && transactions !== undefined}
                visiblePipeIds={pipeIds ?? undefined}
              />
            </Animated.View>
          ) : null}
        </Animated.View>
    </SafeAreaView>
  );
}
