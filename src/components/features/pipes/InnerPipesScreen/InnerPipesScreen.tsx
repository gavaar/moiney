import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { PipeModel } from "@features/pipes/data/pipes";
import { expectedMonthlyCapacity } from "@features/pipes/data/expectedCapacity";
import {
  PipesList,
  type Pipe as PipesListPipe,
} from "@features/pipes/components/PipesList";
import { AmountForm } from "@features/components/AmountForm";
import { Breadcrumb } from "./components/Breadcrumb";
import { OptionsButton } from "./components/OptionsButton";
import { PipeBars } from "./components/PipeBars";
import { RulesIcon } from "./components/RulesIcon";
import { StatisticsRow } from "./components/StatisticsRow";

export function InnerPipesScreen() {
  const { selectedPipe, selectedPipePath, selectPipe } = usePipeSelection();
  const { childrenByParent } = usePipeCatalog();

  const fed = selectedPipe?.fed ?? 0;
  const spent = selectedPipe?.spent ?? 0;
  const pendingFedAdjustment = selectedPipe?.pendingFedAdjustment ?? 0;
  const capacity = selectedPipe?.capacity ?? 0;
  const isDeleting = Boolean(selectedPipe?.deletionJobId);

  const selectedId = selectedPipePath[selectedPipePath.length - 1];
  const children = childrenByParent.get(selectedId) ?? [];
  const expected = selectedPipe
    ? expectedMonthlyCapacity(
        { ...selectedPipe, capacity },
        childrenByParent,
        Date.now(),
      )
    : 0;

  const handleSelectPipe = useCallback(
    (id: PipeModel["id"]) => selectPipe([...selectedPipePath, id]),
    [selectedPipePath, selectPipe],
  );

  const leading = useCallback(
    (pipe: PipesListPipe) => (
      <RulesIcon
        pipeId={pipe.id}
        rule={pipe.rule}
        fed={pipe.fed}
        capacity={pipe.capacity}
        spent={pipe.spent}
        cronNextDate={pipe.cronNextDate}
        cronInterval={pipe.cronInterval}
        disabled={
          (childrenByParent.get(pipe.id)?.length ?? 0) > 0 ||
          Boolean(pipe.deletionJobId)
        }
      />
    ),
    [childrenByParent],
  );

  return (
    <View className="flex-1">
      <View className="flex flex-col">
        <Breadcrumb />
        <PipeBars
          fed={fed}
          spent={spent}
          capacity={capacity}
          expected={expected}
          pendingFedAdjustment={pendingFedAdjustment}
          rule={selectedPipe?.rule}
        />
        <View className="flex-row items-center gap-2 px-5 pb-2">
          <View className="flex-1">
            <StatisticsRow
              fed={fed}
              spent={spent}
              pendingFedAdjustment={pendingFedAdjustment}
            />
          </View>
          <OptionsButton pipeId={selectedId} disabled={isDeleting} />
        </View>
        <View className="border-b self-center border-muted/50 mb-3 w-3/4" />
      </View>

      <View className="flex-1">
        {isDeleting ? (
          <View className="items-center justify-center p-6">
            <Text className="text-muted text-sm">
              Pipe deletion in progress
            </Text>
          </View>
        ) : children.length === 0 && selectedPipe ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <AmountForm pipeId={selectedPipe.id} variant="spend" />
          </ScrollView>
        ) : null}
        <PipesList
          pipes={children}
          priority={true}
          onSelectPipe={handleSelectPipe}
          leading={leading}
        />
      </View>
    </View>
  );
}
