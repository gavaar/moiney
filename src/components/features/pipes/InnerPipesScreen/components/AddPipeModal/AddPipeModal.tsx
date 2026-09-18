import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { parseMoney } from "@domain/money";
import { colors } from "@/lib/styles";
import { Button } from "@ui/Button";
import { Form } from "@ui/Form";
import { Icon, safeIconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { buildAddPipeForm, validatePipeCapacity, validatePipeName, type AddPipeDraft } from "./addPipeForm.config";

type AddPipeModalProps = {
  parentId?: Id<"pipes">;
  visible: boolean;
  onClose: () => void;
};

export function AddPipeModal({ parentId, visible, onClose }: AddPipeModalProps) {
  return (
    <ModalShell visible={visible} onClose={onClose}>
      {visible ? <AddPipeForm key={parentId ?? "no-owner"} parentId={parentId} onClose={onClose} /> : null}
    </ModalShell>
  );
}

export function AddPipeForm({ parentId, onClose }: Omit<AddPipeModalProps, "visible">) {
  const { allPipes, childrenByParent, isLoading } = usePipeCatalog();
  const pipes = (allPipes ?? []).filter(pipe => !pipe.deletionJobId);
  const [draft, setDraft] = useState<AddPipeDraft>({
    ownerId: parentId ?? null, name: "", description: "", icon: "pipe", priority: 0, capacity: "",
  });
  const [activeStep, setActiveStep] = useState(parentId ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const addPipe = useMutation(api.pipes.addPipe);
  const owner = pipes.find(pipe => pipe.id === draft.ownerId);
  const hasChildren = owner ? (childrenByParent.get(owner.id)?.length ?? 0) > 0 : false;
  const willRemoveSpentCapValues = owner && !hasChildren && (owner.capacity > 0 || owner.spent > 0);
  const valid = !!owner && validatePipeName(draft.name) === undefined && validatePipeCapacity(draft.capacity) === undefined;

  async function handleSubmit() {
    if (!valid || !owner || loading) return;
    setLoading(true);
    setSubmitError(undefined);
    try {
      await addPipe({
        parentId: owner.id,
        name: draft.name.trim(),
        description: draft.description || undefined,
        icon: draft.icon || "pipe",
        priority: draft.priority,
        capacity: draft.capacity ? parseMoney(draft.capacity) : 0,
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="gap-4" style={{ flexShrink: 1 }}>
      <Form
        form={buildAddPipeForm(pipes, loading, isLoading)}
        value={draft}
        onChange={next => {
          setDraft(next);
          // This is an interaction, not an effect: Back must stay on the owner step.
          if (activeStep === 0 && pipes.some(pipe => pipe.id === next.ownerId)) setActiveStep(1);
        }}
        activeStep={activeStep}
        onStepChange={step => { if (!loading) setActiveStep(step); }}
        header={
          <View className="flex-row items-center gap-2 border-b border-muted/20 p-2"
            accessibilityRole="header" accessibilityLabel={owner?.name ?? "Select owner pipe"}>
            <Icon name={owner ? safeIconName(owner.icon) : "pipe-disconnected"} size={24} color={colors.muted} />
            <Text className="flex-1 text-md font-medium text-muted" numberOfLines={1}>
              {owner?.name ?? "Select owner pipe"}
            </Text>
          </View>
        }
        finalAction={<Button title="Submit" onPress={handleSubmit} loading={loading} disabled={!valid} />}
      />
      {activeStep === 2 && owner ? (
        <View className="gap-2">
          {willRemoveSpentCapValues ? (
            <View className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
              <Text className="text-warning text-sm">Creating a child will remove current capacity and spent values.</Text>
            </View>
          ) : null}
          {!hasChildren ? (
            <View className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
              <Text className="text-warning text-sm">
                Adding a pipe removes the ability to add transactions from this pipe. All transactions should happen from a childless pipe.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {submitError ? <Text accessibilityRole="alert" className="text-sm text-error">{submitError}</Text> : null}
    </View>
  );
}
