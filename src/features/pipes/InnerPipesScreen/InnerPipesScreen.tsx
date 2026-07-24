import { Text, View } from "react-native";
import { usePipeSelection, toPipe } from "@/features/pipes/context/PipeSelectionContext";
import { PipesList } from "@/features/pipes/components/PipesList";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/styles";
import { SpentForm } from "@/features/components/SpentForm";
import { AddPipeButton } from "./components/AddPipeButton";
import { Breadcrumb } from "./components/Breadcrumb";
import { PipeBars } from "./components/PipeBars";
import { StatisticsRow } from "./components/StatisticsRow";

export function InnerPipesScreen() {
  const { selectedPipe, selectedPipePath, childrenByParent, selectPipe } = usePipeSelection();

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
      <View className="flex flex-col">
        <Breadcrumb />
        <PipeBars fed={fed} spent={spent} capacity={capacity} max={max} />
        <StatisticsRow fed={fed} spent={spent} />
        <View className="border-b self-center border-muted/50 mb-3 w-3/4" />
      </View>

      <View className="flex-1">
        {children.length === 0 && selectedPipe ? (
          <SpentForm pipeId={selectedPipe._id} />
        ) : null}
        <PipesList
          pipes={children}
          priority={true}
          onSelectPipe={(id) => selectPipe([...selectedPipePath, id])}
          leading={() => <Icon name="lock-open-outline" size={16} color={colors.border} />}
          footer={<AddPipeButton parentId={selectedPipePath[selectedPipePath.length - 1]} />}
        />
      </View>
    </View>
  );
}
