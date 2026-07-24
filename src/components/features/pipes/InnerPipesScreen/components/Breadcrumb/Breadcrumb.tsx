import { Text, TouchableOpacity, View } from "react-native";
import { Icon } from "@ui/Icon";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";

export function Breadcrumb() {
  const { selectedPipePath, allPipes, selectPipe } = usePipeSelection();

  const items = selectedPipePath.map((id) => {
    const pipe = allPipes?.find((p) => p._id === id);
    return { id, name: pipe?.name ?? id, icon: pipe?.icon ?? 'pipe' };
  });

  return (
    <View className="flex-row items-center gap-2 pb-3">
      <TouchableOpacity
        testID="breadcrumb-home"
        onPress={() => selectPipe([])}
        className="rounded-full p-1"
      >
        <Icon name={items[0]?.icon ?? 'pipe'} size={18} />
      </TouchableOpacity>
      {items.map((item, index) => (
        <View key={item.id} className="flex-row items-center gap-2">
          <Text className="text-muted">›</Text>
          <TouchableOpacity
            onPress={() => selectPipe(selectedPipePath.slice(0, index + 1))}
          >
            <Text className="text-text text-lg">{item.name}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}
