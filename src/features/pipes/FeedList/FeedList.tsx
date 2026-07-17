import { ScrollView, View } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { FeedBox } from "@/components/ui/FeedBox";
import { FeedAmountModal } from "./components/FeedAmountModal";

type Feed = {
  _id: Id<"pipes">;
  name: string;
  icon: string;
  capacity: number;
  fed: number;
  spent: number;
};

type FeedListProps = {
  feeds: Feed[];
};

export function FeedList({ feeds }: FeedListProps) {
  return (
    <ScrollView contentContainerStyle={{ gap: 8 }}>
      {feeds.map((item) => (
        <View
          key={item._id}
          className="flex-row items-center gap-2"
        >
          <FeedBox
            name={item.name}
            icon={item.icon}
            capacity={item.capacity}
            fed={item.fed}
            spent={item.spent}
            onPress={() => console.log(item)}
          />

          <FeedAmountModal pipeId={item._id} feedName={item.name} />
        </View>
      ))}
    </ScrollView>
  );
}
