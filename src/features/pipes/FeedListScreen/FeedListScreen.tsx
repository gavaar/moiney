import { ActivityIndicator, Text, View } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { colors } from "@/lib/styles";
import { AddFeedButton, FeedList } from "@/features/pipes/FeedListScreen/components";

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
    <>
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
          <FeedList pipes={pipes} onSelectFeed={onSelectFeed} />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-mutedForeground text-base">
              Add your first{" "}
              <Text className="underline">feed</Text>.
            </Text>
          </View>
        )}

        <View className="self-center my-2">
          <AddFeedButton />
        </View>
      </View>
    </>
  );
}
