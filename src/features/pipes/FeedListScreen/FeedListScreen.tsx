import { ActivityIndicator, Text, View } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { colors } from "@/lib/styles";
import { PipesList } from "@/features/pipes/components/PipesList";
import { AddFeedButton, FeedAmountModal } from "@/features/pipes/FeedListScreen/components";

type Pipe = {
  _id: Id<"pipes">;
  name: string;
  icon: string;
  capacity: number;
  fed: number;
  spent: number;
};

type FeedListScreenProps = {
  isLoading: boolean;
  pipes: Pipe[];
  onSelectFeed: (id: Id<"pipes">) => void;
};

export function FeedListScreen({
  isLoading,
  pipes,
  onSelectFeed,
}: FeedListScreenProps) {
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
          <Text className="text-muted text-base">
            Add your first{" "}
            <Text className="underline">feed</Text>.
          </Text>
        </View>
      )}
      {!isLoading && pipes.length > 0 ? null : (
        <View className="items-center py-2 border-t border-border/30">
          <AddFeedButton />
        </View>
      )}
    </View>
  );
}
