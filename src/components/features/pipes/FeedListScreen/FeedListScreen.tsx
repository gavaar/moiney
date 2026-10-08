import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { colors } from "@/lib/styles";
import { PipesList } from "@features/pipes/components/PipesList";
import type { PipeModel } from "@features/pipes/data/pipes";
import { AddFeedButton, FeedAmountModal } from "@features/pipes/FeedListScreen/components";
import { ModalShell } from '@ui/Modal';
import { useState } from 'react';
import { Icon } from "@ui/Icon";

type FeedListScreenProps = {
  isLoading: boolean;
  pipes: PipeModel[];
  onSelectFeed: (id: PipeModel["id"]) => void;
};

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

export function FeedListScreen({
  isLoading,
  pipes,
  onSelectFeed,
}: FeedListScreenProps) {
  const [showFeedInfo, setShowFeedInfo] = useState(false);
  const [fundingFeedId, setFundingFeedId] = useState<PipeModel["id"] | null>(null);
  const fundingFeed = pipes.find(pipe => pipe.id === fundingFeedId);

  return (
    <View className="flex-1">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            testID="loading-indicator"
            accessibilityLabel="Loading feeds"
            size="small"
            color={colors.primary}
          />
        </View>
      ) : pipes.length > 0 ? (
        <PipesList
          pipes={pipes}
          onSelectPipe={onSelectFeed}
          compactAction={{
            label: () => "Add money",
            onPress: (pipe) => setFundingFeedId(pipe.id),
          }}
           trailing={(pipe) => (
              <Pressable className="p-2 rounded-full" accessibilityRole="button"
                accessibilityLabel={`Add money to ${pipe.name}`} testID="feed-amount-trigger"
                onPress={() => setFundingFeedId(pipe.id)}>
                <Icon name="add-circle-outline" size={24} color="white" />
              </Pressable>
           )}
          footer={<AddFeedButton />}
        />
      ) : (
        <View className="gap-2">
          <Pressable className="items-center py-2" onPress={() => setShowFeedInfo(true)}>
            <Text className="text-muted text-base">
              Add your first{" "}
              <Text className="underline">feed</Text>.
            </Text>
          </Pressable>
          <AddFeedButton />
        </View>
      )}

      <ModalShell visible={showFeedInfo} onClose={() => setShowFeedInfo(false)}>
        <FeedDescription />
      </ModalShell>
      {fundingFeed && (
        <FeedAmountModal
          pipeId={fundingFeed.id}
          feedName={fundingFeed.name}
          sourceType={fundingFeed.sourceType}
          fed={fundingFeed.fed}
          visible
          hideTrigger
          onClose={() => setFundingFeedId(null)}
        />
      )}
    </View>
  );
}
