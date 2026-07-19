import { Text, View } from "react-native";
import { usePipeSelection } from "@/features/pipes/context/PipeSelectionContext";
import { AddPipeButton } from "./components/AddPipeButton";
import { Breadcrumb } from "./components/Breadcrumb";
import { PipeBars } from "./components/PipeBars";

export function InnerPipesScreen() {
  const { selectedName, selectedPipe } = usePipeSelection();

  const fed = selectedPipe?.fed ?? 0;
  const spent = selectedPipe?.spent ?? 0;
  const capacity = selectedPipe?.capacity ?? 0;
  const max = Math.max(fed, spent, capacity);

  return (
    <View className="flex-1">
      <View>
        <Breadcrumb />
        <PipeBars fed={fed} spent={spent} capacity={capacity} max={max} />
        <Text className="text-muted text-xs pb-3">statistics</Text>
        <AddPipeButton />
        <View className="border-b border-muted mb-3" />
      </View>
      <Text className="text-text text-xl">selected {selectedName}</Text>
    </View>
  );
}
