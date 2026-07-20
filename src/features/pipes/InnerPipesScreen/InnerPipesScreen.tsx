import { Text, View } from "react-native";
import { usePipeSelection, toPipe } from "@/features/pipes/context/PipeSelectionContext";
import { PipesList } from "@/features/pipes/components/PipesList";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/styles";
import { AddPipeButton } from "./components/AddPipeButton";
import { Breadcrumb } from "./components/Breadcrumb";
import { PipeBars } from "./components/PipeBars";

export function InnerPipesScreen() {
  const { selectedName, selectedPipe, selectedPipePath, childrenByParent, selectPipe } = usePipeSelection();

  const fed = selectedPipe?.fed ?? 0;
  const spent = selectedPipe?.spent ?? 0;
  const capacity = selectedPipe?.capacity ?? 0;
  const max = Math.max(fed, spent, capacity);

  const selectedId = selectedPipePath[selectedPipePath.length - 1];
  const children = selectedId
    ? (childrenByParent.get(selectedId) ?? []).map(toPipe)
    : [];

  return (
    <View className="flex-1">
      <View>
        <Breadcrumb />
        <PipeBars fed={fed} spent={spent} capacity={capacity} max={max} />
        <Text className="text-muted text-xs pb-3">statistics</Text>
        <View className="border-b self-center border-muted/50 mb-3 w-3/4" />
      </View>

      <View className="flex-1">
        <PipesList
          pipes={children}
          priority={true}
          onSelectPipe={(id) => selectPipe([...selectedPipePath, id])}
          leading={() => <Icon name="lock-open-outline" size={24} color={colors.text} />}
          footer={<AddPipeButton parentId={selectedPipePath[selectedPipePath.length - 1]} />}
        />
      </View>
    </View>
  );
}
