import { Text, TouchableOpacity, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { usePipeSelection } from "@/features/pipes/context/PipeSelectionContext";

export function InnerPipesScreen() {
  const { selectedPipePath, allPipes, selectPipe, selectedName } =
    usePipeSelection();

  const breadcrumbs = selectedPipePath.map((id) => {
    const pipe = allPipes?.find((p) => p._id === id);
    return { id, name: pipe?.name ?? id };
  });

  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-2 border-b border-muted pb-3 mb-3">
        <TouchableOpacity
          testID="breadcrumb-home"
          onPress={() => selectPipe([])}
          className="rounded-full p-1"
        >
          <Icon name="pipe" size={18} />
        </TouchableOpacity>
        {breadcrumbs.map((item, index) => (
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
      <Text className="text-text text-xl">selected {selectedName}</Text>
    </View>
  );
}
