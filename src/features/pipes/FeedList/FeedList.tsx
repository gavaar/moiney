import { ScrollView, View } from "react-native";
import { FeedBox } from "@/components/ui/FeedBox";

type Feed = {
  _id: string;
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
        <FeedBox
          key={item._id}
          name={item.name}
          icon={item.icon}
          capacity={item.capacity}
          fed={item.fed}
          spent={item.spent}
          onPress={() => console.log(item)}
        />
      ))}
    </ScrollView>
  );
}
