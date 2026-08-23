import { Pressable, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import type { TreeRowData } from "./treeRows";
import { MiniBar } from "./MiniBar";

export function TreeRow({
  row,
  onPress,
}: {
  row: TreeRowData;
  onPress: () => void;
}) {
  const { prefix, pipe, groupMax, isLeaf } = row;

  return (
    <Pressable onPress={onPress} className="flex-row items-center py-1">
      <View className="flex-1 flex-row items-center">
        <Text className="text-muted font-mono text-sm shrink-0">{prefix}</Text>
        <Icon name={pipe.icon as any} size={18} />
        <Text className="text-text text-base ml-1 shrink" numberOfLines={1}>
          {pipe.name}
        </Text>
      </View>
      {isLeaf ? (
        <MiniBar
          fed={pipe.fed}
          spent={pipe.spent}
          capacity={pipe.capacity}
          maxVal={groupMax}
        />
      ) : null}
    </Pressable>
  );
}
