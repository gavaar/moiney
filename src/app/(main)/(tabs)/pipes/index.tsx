import { Text, View } from "react-native";
import { useModal } from "@/components/ui/Modal";
import AddFeedButton from "@/features/pipes/AddFeedButton";

const FeedDescription = () => <Text className="text-text text-base">
  A feed is the source of money.{"\n\n"}
  When you add money, you do it to a feed, which will then
  cascade it down to your different budgets (pipes).{"\n\n"}
  The final pipes in a tree are the drains. You can only
  spend money from a drain, and you can only add money to a
  feed.{"\n\n"}
  This allows the feed to create budgets according to your
  rules, and then spend from these budgets.{"\n\n"}
  This helps organize money into logical buckets, and makes
  it easier to understand where your money is going.
</Text>;

export default function Pipes() {
  const { open } = useModal();
  const hasFeeds = false;

  return (
    <View className="flex-1 items-center gap-4 justify-center bg-background">
      {hasFeeds ? (
        <Text className="text-3xl font-bold text-text">pipes</Text>
      ) : (
        <Text className="text-mutedForeground text-base">
          Add your first{" "}
          <Text
            className="underline"
            onPress={() => open(<FeedDescription />)}
          >
            feed
          </Text>
          .
        </Text>
      )}

      <AddFeedButton />
    </View>
  );
}
