import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ModalShell } from "@/components/ui/Modal";
import { colors } from "@/lib/styles";
import { ScreenHeader } from "@/components/ui/ScreenHeader/ScreenHeader";
import AddFeedButton from "@/features/pipes/AddFeedButton";
import { FeedList } from "@/features/pipes/FeedList";

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
  const [showFeedInfo, setShowFeedInfo] = useState(false);
  const pipes = useQuery(api.pipes.getPipes);

  const feeds = (pipes ?? [])
    .filter((p) => p.parentId === undefined)
    .map(({ _id, name, icon, description, capacity, fed, spent }) => ({
      _id,
      name,
      icon,
      description,
      capacity: capacity ?? 0,
      fed: fed ?? 0,
      spent: spent ?? 0,
    }));

  return (
    <SafeAreaView className="flex-1 bg-background px-4">
      <ScreenHeader title="Pipes" />

      <View className="flex-1">
        {pipes === undefined ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : feeds.length > 0 ? (
          <FeedList feeds={feeds} />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-mutedForeground text-base">
              Add your first{" "}
              <Text className="underline" onPress={() => setShowFeedInfo(true)}>
                feed
              </Text>
              .
            </Text>
          </View>
        )}

        <View className="self-center my-2">
          <AddFeedButton />
        </View>
      </View>

      <View className="flex-1 items-center justify-center">
        <Text className="text-mutedForeground text-base">history</Text>
      </View>

      <ModalShell visible={showFeedInfo} onClose={() => setShowFeedInfo(false)}>
        <FeedDescription />
      </ModalShell>
    </SafeAreaView>
  );
}
