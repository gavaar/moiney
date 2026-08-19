import { memo, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { PipeBox, type ChildSnapshot } from "@ui/PipeBox";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import type { PipeModel } from "@features/pipes/data/pipes";

export type Pipe = Pick<
  PipeModel,
  | "id"
  | "name"
  | "icon"
  | "priority"
  | "capacity"
  | "fed"
  | "spent"
  | "deletionJobId"
  | "rule"
  | "cronNextDate"
  | "cronInterval"
>;

type PipesListProps = {
  pipes: Pipe[];
  onSelectPipe?: (id: PipeModel["id"]) => void;
  leading?: (pipe: Pipe) => ReactNode;
  trailing?: (pipe: Pipe) => ReactNode;
  priority?: boolean;
  footer?: ReactNode;
};

export const PipesList = memo(function PipesList({
  pipes,
  onSelectPipe,
  leading,
  trailing,
  priority = false,
  footer,
}: PipesListProps) {
  const { childrenByParent } = usePipeSelection();

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ flexGrow:1, gap: 8 }}>
      {pipes.map((item, idx) => {
        const childBoxes: ChildSnapshot[] | undefined = (childrenByParent.get(item.id) ?? []).map((child) => ({
          icon: child.icon,
          capacity: child.capacity ?? 0,
          fed: child.fed ?? 0,
          spent: child.spent ?? 0,
        }));

        return (
          <View key={item.id} className="flex-row items-center">
            {leading?.(item)}
            <PipeBox
              name={item.name}
              icon={item.icon}
              priority={item.priority}
              capacity={item.capacity}
              fed={item.fed}
              spent={item.spent}
              showPriority={priority && item.priority !== pipes[idx - 1]?.priority}
              children={childBoxes}
              onPress={() => onSelectPipe?.(item.id)}
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
});
