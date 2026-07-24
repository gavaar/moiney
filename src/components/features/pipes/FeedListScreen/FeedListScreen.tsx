import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { colors } from "@/lib/styles";
import { PipesList } from "@features/pipes/components/PipesList";
import { AddFeedButton, FeedAmountModal } from "@features/pipes/FeedListScreen/components";
import { Pipe } from '../context/PipeSelectionContext';
import { ModalShell } from '@ui/Modal';
import { useState } from 'react';

type FeedListScreenProps = {
  isLoading: boolean;
  pipes: Pipe[];
  onSelectFeed: (id: Id<"pipes">) => void;
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

  return (
    <View className="flex-1">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            testID="loading-indicator"
            size="small"
            color={colors.primary}
          />
        </View>
      ) : pipes.length > 0 ? (
        <PipesList
          pipes={pipes}
          onSelectPipe={onSelectFeed}
          trailing={(pipe) => <FeedAmountModal pipeId={pipe._id} feedName={pipe.name} />}
          footer={<View className="self-center my-2"><AddFeedButton /></View>}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Pressable onPress={() => setShowFeedInfo(true)}>
            <Text className="text-muted text-base">
              Add your first{" "}
              <Text className="underline">feed</Text>.
            </Text>
          </Pressable>
        </View>
      )}
      {!isLoading && pipes.length > 0 ? null : (
        <View className="items-center py-2 border-t border-border/30">
          <AddFeedButton />
        </View>
      )}

      <ModalShell visible={showFeedInfo} onClose={() => setShowFeedInfo(false)}>
        <FeedDescription />
      </ModalShell>
    </View>
  );
}
