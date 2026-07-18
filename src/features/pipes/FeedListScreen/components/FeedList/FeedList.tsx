import { ScrollView, View } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { FeedBox } from "@/components/ui/FeedBox";
import { FeedAmountModal } from "./components";

type Pipe = {
  _id: Id<"pipes">;
  name: string;
  icon: string;
  capacity: number;
  fed: number;
  spent: number;
};

type FeedListProps = {
  pipes: Pipe[];
  onSelectFeed?: (id: Id<"pipes">) => void;
};

export function FeedList({ pipes, onSelectFeed }: FeedListProps) {
  return (
    <ScrollView contentContainerStyle={{ gap: 8 }}>
      {pipes.map((item) => (
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
            onPress={() => onSelectFeed?.(item._id)}
          />

          <FeedAmountModal pipeId={item._id} feedName={item.name} />
        </View>
      ))}
    </ScrollView>
  );
}
