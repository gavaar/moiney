import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { useNavigation } from "expo-router";
import type { ParamListBase } from "expo-router/react-navigation";
import type { BottomTabNavigationProp } from "expo-router/tabs";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppScreenHeader } from "@features/app/AppScreenHeader";
import { SlideToggle } from "@ui/SlideToggle";
import { Icon } from "@ui/Icon";
import { MonthlyStatisticsCard } from "@features/statistics/MonthlyStatisticsCard";
import { useCurrentMonthReportContext } from "@features/statistics/CurrentMonthReportContext";
import { colors } from "@/lib/styles";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { InnerPipesScreen } from "@features/pipes/InnerPipesScreen";
import { PipeTreeView } from "@features/pipes/PipeTreeView";
import { FeedListScreen } from "@features/pipes/FeedListScreen";
import { orderFeedsByEventTreeUsage } from "@features/transactions/history/event-usage";
import { useTransactionCache } from "@features/transactions/cache/TransactionCacheContext";
import { useEventHistory } from "@features/transactions/cache/useEventHistory";
import { getSubtreePipeIds } from "@features/pipes/data/subtree";
import { MixedHistoryFeed } from "@features/transactions/history/mixed-history-feed";

export function PipesScreen({ openPipeId, onPipeOpened, onOpenCurrentReport }: { openPipeId?: string; onPipeOpened?: () => void; onOpenCurrentReport?: () => void } = {}) {
  const navigation = useNavigation();
  const [treeMode, setTreeMode] = useState(false);
  const [latestExpanded, setLatestExpanded] = useState(true);
  const { selectedName, selectedPipePath, selectPipe, deselectPipe } = usePipeSelection();
  const { allPipes, childrenByParent, feeds, isLoading } = usePipeCatalog();
  const resolvedOpenPipeId = openPipeId && allPipes?.some((pipe) => pipe.id === openPipeId) ? openPipeId : undefined;
  const [lastOpenPipeId, setLastOpenPipeId] = useState(resolvedOpenPipeId);
  if (lastOpenPipeId !== resolvedOpenPipeId) {
    setLastOpenPipeId(resolvedOpenPipeId);
    if (resolvedOpenPipeId) {
      setTreeMode(false);
      setLatestExpanded(true);
    }
  }
  const { report } = useCurrentMonthReportContext();
  useEffect(() => {
    if (!openPipeId || !allPipes) return;
    const path: NonNullable<typeof allPipes>[number]["id"][] = [];
    let pipe = allPipes.find((candidate) => candidate.id === openPipeId);
    while (pipe && !path.includes(pipe.id)) {
      path.unshift(pipe.id);
      pipe = pipe.parentId ? allPipes.find((candidate) => candidate.id === pipe!.parentId) : undefined;
    }
    if (path.length > 0) {
      selectPipe(path);
    }
    onPipeOpened?.();
  }, [allPipes, openPipeId, onPipeOpened, selectPipe]);
  const { eventHistory: historySnapshot } = useTransactionCache();
  const { entries: historyEntries } = useEventHistory(
    {
      enabled: historySnapshot.updatedAt > 0 && !treeMode && !selectedName,
      minimumCachedRows: 100,
    },
  );
  const orderedFeeds = useMemo(
    () =>
      orderFeedsByEventTreeUsage(
        feeds,
        allPipes ?? [],
        historyEntries,
      ),
    [allPipes, feeds, historyEntries],
  );

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
      const tabs = navigation.getParent<BottomTabNavigationProp<ParamListBase>>();
      const pipesTabKey = tabs?.getState().routes.find((route) => route.name === "pipes")?.key;
      const removeTabListener = tabs?.addListener("tabPress", (event) => {
        if (event.target === pipesTabKey) deselectPipe();
      });
      return () => {
        subscription.remove();
        removeTabListener?.();
      };
    }, [deselectPipe, navigation, selectedPipePath, selectPipe]),
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background pb-1">
      <AppScreenHeader
        title="Pipes"
        right={
          <SlideToggle
            options={[
              { value: "bar", label: "Bar view", icon: "align-horizontal-left" },
              { value: "tree", label: "Tree view", icon: "file-tree" },
            ]}
            value={treeMode ? "tree" : "bar"}
            onChange={(v) => {
              setTreeMode(v === "tree");
              setLatestExpanded(true);
              if (v === "tree") deselectPipe();
            }}
          />
        }
      />

      {!treeMode && !selectedName ? (
        <View className="px-2 pb-3">
          {report ? (
            <MonthlyStatisticsCard report={report} live offenderIcon={allPipes?.find((pipe) => pipe.id === report.offenders?.[0]?.pipeId)?.icon} onPress={() => onOpenCurrentReport?.()} />
          ) : (
            <ActivityIndicator accessibilityLabel="Loading current month summary" color={colors.primary} />
          )}
        </View>
      ) : null}
      <View className="flex-1 px-2">
        {treeMode ? (
          <PipeTreeView
            onSelectPipe={(path) => {
              selectPipe(path);
              setTreeMode(false);
            }}
          />
        ) : selectedName ? (
          <View className="flex-1">
            <View style={{ flex: latestExpanded ? 3 : 1 }}>
              <InnerPipesScreen />
            </View>
            {allPipes && selectedPipePath.length > 0 ? (
              <View className="overflow-hidden" style={{ flex: latestExpanded ? 2 : 0 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${latestExpanded ? "Collapse" : "Expand"} latest transactions`}
                  accessibilityState={{ expanded: latestExpanded }}
                  onPress={() => setLatestExpanded((expanded) => !expanded)}
                  className="my-2 flex-row items-center justify-between rounded-md bg-surface px-3 py-2"
                >
                  <Text className="text-base font-semibold text-text">Latest transactions</Text>
                  <Icon name={latestExpanded ? "chevron-down" : "chevron-up"} size={18} color={colors.text} />
                </Pressable>
                <View className="flex-1" style={{ display: latestExpanded ? "flex" : "none" }}>
                  <MixedHistoryFeed
                    recent
                    enabled={latestExpanded}
                    filters={{ pipeIds: getSubtreePipeIds(childrenByParent, selectedPipePath[selectedPipePath.length - 1]) ?? [] }}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <FeedListScreen
            isLoading={isLoading}
            pipes={orderedFeeds}
            onSelectFeed={(id) => selectPipe([id])}
          />
        )}
      </View>

    </SafeAreaView>
  );
}
