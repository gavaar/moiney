import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ModalShell } from "@/components/ui/Modal";
import { ScreenHeader } from "@/components/ui/ScreenHeader/ScreenHeader";
import { PipeSelectionProvider, usePipeSelection } from "@/features/pipes/context/PipeSelectionContext";
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
  return (
    <PipeSelectionProvider>
      <PipesInner />
    </PipeSelectionProvider>
  );
}

function PipesInner() {
  const [showFeedInfo, setShowFeedInfo] = useState(false);
  const { feeds, isLoading, selectedName, selectPipe } = usePipeSelection();

  return (
    <SafeAreaView className="flex-1 bg-background px-4">
      <ScreenHeader title="Pipes" />

      {selectedName ? (
        <InnerPipesScreen />
      ) : (
        <FeedListScreen
          isLoading={isLoading}
          pipes={feeds}
          onSelectFeed={(id) => selectPipe([id])}
        />
      )}

      <View className="flex-1 items-center justify-center">
        <Text className="text-muted text-base">history</Text>
      </View>

      <ModalShell visible={showFeedInfo} onClose={() => setShowFeedInfo(false)}>
        <FeedDescription />
      </ModalShell>
    </SafeAreaView>
  );
}
