import { type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { PipeBox } from "@/components/ui/PipeBox";

type Pipe = {
  _id: Id<"pipes">;
  name: string;
  icon: string;
  capacity: number;
  fed: number;
  spent: number;
};

type PipesListProps = {
  pipes: Pipe[];
  onSelectPipe?: (id: Id<"pipes">) => void;
  leading?: (pipe: Pipe) => ReactNode;
  trailing?: (pipe: Pipe) => ReactNode;
  footer?: ReactNode;
};

export function PipesList({ pipes, onSelectPipe, leading, trailing, footer }: PipesListProps) {
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ gap: 8 }}>
      {pipes.map((item) => (
        <View key={item._id} className="flex-row items-center gap-2">
          {leading?.(item)}
          <PipeBox
            name={item.name}
            icon={item.icon}
            capacity={item.capacity}
            fed={item.fed}
            spent={item.spent}
            onPress={() => onSelectPipe?.(item._id)}
          />
          {trailing?.(item)}
        </View>
      ))}

      <View className="justify-self-end">
        {footer}
      </View>
    </ScrollView>
  );
}
