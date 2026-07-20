import { type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { PipeBox } from "@/components/ui/PipeBox";

type Pipe = {
  _id: Id<"pipes">;
  name: string;
  icon: string;
  priority: number;
  capacity: number;
  fed: number;
  spent: number;
};

type PipesListProps = {
  pipes: Pipe[];
  onSelectPipe?: (id: Id<"pipes">) => void;
  leading?: (pipe: Pipe) => ReactNode;
  trailing?: (pipe: Pipe) => ReactNode;
  priority?: boolean;
  footer?: ReactNode;
};

export function PipesList({ pipes, onSelectPipe, leading, trailing, priority, footer }: PipesListProps) {
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ flexGrow:1, gap: 8 }}>
      {pipes.map((item, idx) => (
        <View key={item._id} className="flex-row items-center gap-2">
          {leading?.(item)}
          <PipeBox
            name={item.name}
            icon={item.icon}
            priority={priority && item.priority !== pipes[idx - 1]?.priority ? item.priority : undefined}
            capacity={item.capacity}
            fed={item.fed}
            spent={item.spent}
            onPress={() => onSelectPipe?.(item._id)}
          />
          {trailing?.(item)}
        </View>
      ))}

      <View className="mt-auto">
        {footer}
      </View>
    </ScrollView>
  );
}
