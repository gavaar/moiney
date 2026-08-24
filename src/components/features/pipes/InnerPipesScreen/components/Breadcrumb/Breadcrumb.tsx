import { Text, TouchableOpacity, View } from "react-native";
import { Icon } from "@ui/Icon";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";

export function Breadcrumb() {
  const { selectedPipePath, selectPipe } = usePipeSelection();
  const { allPipes } = usePipeCatalog();

  const items = selectedPipePath.map((id) => {
    const pipe = allPipes?.find((p) => p.id === id);
    return { id, name: pipe?.name ?? id, icon: pipe?.icon ?? 'pipe' };
  });

  return (
    <View className="flex-row items-center gap-2 pb-3">
      <TouchableOpacity
        testID="breadcrumb-home"
        accessibilityRole="button"
        accessibilityLabel="Go to pipe root"
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
