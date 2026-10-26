import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { PipeModel } from "@features/pipes/data/pipes";
import { expectedMonthlyCapacity } from "@domain/statistics/expectedMonthlyCapacity";
import { prepareContingencyPreview } from "@features/pipes/data/contingencyPreview";
import {
  PipesList,
  type Pipe as PipesListPipe,
} from "@features/pipes/components/PipesList";
import { AmountForm } from "@features/components/AmountForm";
import { Breadcrumb } from "./components/Breadcrumb";
import { OptionsButton } from "./components/OptionsButton";
import { PipeBars } from "./components/PipeBars";
import { RulesIcon } from "./components/RulesIcon";
import { EditPipeModal } from "./components/EditPipeModal";
import { StatisticsRow } from "./components/StatisticsRow";
import { AddChildPipeButton } from "./components/AddChildPipeButton";
import { useRuleClock } from "@features/pipes/rules/use-rule-clock";
import { useMonthlyPipeSpending } from "@features/statistics/useMonthlyPipeSpending";

export function InnerPipesScreen() {
  const [compactRulePipeId, setCompactRulePipeId] = useState<PipeModel["id"] | null>(null);
  const { selectedPipe, selectedPipePath, selectPipe } = usePipeSelection();
  const { childrenByParent, allPipes } = usePipeCatalog();

  const fed = selectedPipe?.fed ?? 0;
  const spent = selectedPipe?.spent ?? 0;
  const pendingFedAdjustment = selectedPipe?.pendingFedAdjustment ?? 0;
  const capacity = selectedPipe?.capacity ?? 0;
  const visualCapacity =
    selectedPipe?.sourceType === "boiler"
      ? (selectedPipe.contributedFed ?? 0)
      : capacity;
  const isDeleting = Boolean(selectedPipe?.deletionJobId);

  const selectedId = selectedPipePath[selectedPipePath.length - 1];
  const coverageProvided = selectedId ? prepareContingencyPreview(allPipes ?? []).forDonor(selectedId) : undefined;
  const children = childrenByParent.get(selectedId) ?? [];
  const ruleNow = useRuleClock(Boolean(selectedPipe));
  const monthlySpent = useMonthlyPipeSpending(selectedId ?? null, ruleNow);
  const expected = selectedPipe
    ? expectedMonthlyCapacity(
        { ...selectedPipe, capacity },
        childrenByParent,
        ruleNow,
      )
    : 0;

  const handleSelectPipe = useCallback(
    (id: PipeModel["id"]) => selectPipe([...selectedPipePath, id]),
    [selectedPipePath, selectPipe],
  );

  const trailing = useCallback(
    (pipe: PipesListPipe) => (
      <RulesIcon
        pipeId={pipe.id}
        rule={pipe.rule}
        fed={pipe.fed}
        capacity={pipe.capacity}
        spent={pipe.spent}
        cronNextDate={pipe.cronNextDate}
        cronInterval={pipe.cronInterval}
        now={ruleNow}
        disabled={
          (childrenByParent.get(pipe.id)?.length ?? 0) > 0 ||
          Boolean(pipe.deletionJobId)
        }
      />
    ),
    [childrenByParent, ruleNow],
  );

  return (
    <View className="flex-1">
      <View className="flex flex-col">
        <View className="flex-row items-center gap-3 pr-5 pb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
            <Breadcrumb />
          </ScrollView>
          <OptionsButton pipeId={selectedId} disabled={isDeleting} />
        </View>
        <PipeBars
          fed={fed}
          spent={spent}
          capacity={visualCapacity}
          expected={expected}
          pendingFedAdjustment={pendingFedAdjustment}
          rule={selectedPipe?.rule}
          sourceType={selectedPipe?.sourceType}
          coverageProvidedCents={coverageProvided?.amountCents}
        />
        <View className="px-5 pb-2">
          <StatisticsRow
            fed={fed}
            spent={spent}
            monthlySpent={monthlySpent}
            expected={expected}
            pendingFedAdjustment={pendingFedAdjustment}
            sourceType={selectedPipe?.sourceType}
            contributedFed={selectedPipe?.contributedFed}
            now={ruleNow}
          />
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
          <View style={{ flex: 1 }}>
            <AmountForm pipeId={selectedPipe.id} variant="spend" />
          </View>
        ) : null}
        {children.length > 0 ? <PipesList
          pipes={children}
          priority={true}
          onSelectPipe={handleSelectPipe}
          compactAction={{
            label: (pipe) => (childrenByParent.get(pipe.id)?.length ?? 0) > 0 || pipe.deletionJobId
              ? null : "Rule settings",
            onPress: (pipe) => setCompactRulePipeId(pipe.id),
          }}
           trailing={trailing}
           footer={!isDeleting && selectedId ? <AddChildPipeButton key={selectedId} parentId={selectedId} /> : null}
        /> : null}
      </View>
      {compactRulePipeId && (
        <EditPipeModal
          visible
          initialStep={0}
          pipeId={compactRulePipeId}
          onClose={() => setCompactRulePipeId(null)}
        />
      )}
    </View>
  );
}
