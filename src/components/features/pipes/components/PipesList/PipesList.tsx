import { type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { type Id } from "@convex/_generated/dataModel";
import { PipeBox, type ChildSnapshot } from "@ui/PipeBox";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";

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
  const { childrenByParent } = usePipeSelection();

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ flexGrow:1, gap: 8 }}>
      {pipes.map((item, idx) => {
        const childBoxes: ChildSnapshot[] | undefined = (childrenByParent.get(item._id) ?? []).map((child) => ({
          icon: child.icon,
          capacity: child.capacity ?? 0,
          fed: child.fed ?? 0,
          spent: child.spent ?? 0,
        }));

        return (
          <View key={item._id} className="flex-row items-center gap-2">
            {leading?.(item)}
            <PipeBox
              name={item.name}
              icon={item.icon}
              priority={priority && item.priority !== pipes[idx - 1]?.priority ? item.priority : undefined}
              capacity={item.capacity}
              fed={item.fed}
              spent={item.spent}
              children={childBoxes}
              onPress={() => onSelectPipe?.(item._id)}
            />
            {trailing?.(item)}
          </View>
        );
      })}

      <View className="mt-auto">
        {footer}
      </View>
    </ScrollView>
  );
}
