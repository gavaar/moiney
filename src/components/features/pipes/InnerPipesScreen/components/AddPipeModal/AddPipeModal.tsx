import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { parseMoney } from "@domain/money";
import { colors } from "@/lib/styles";
import { Button } from "@ui/Button";
import { Form, FormActionRow } from "@ui/Form";
import { Icon, safeIconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { buildAddPipeForm, validatePipeCapacity, validatePipeName, type AddPipeDraft } from "./addPipeForm.config";
import { createRuleDraft, mergeRuleDraft, ruleConfigurationFromDraft, validateRuleDraft } from "@features/pipes/rules/rule-form";
import { useRuleClock } from "@features/pipes/rules/use-rule-clock";

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
  const [draft, setDraft] = useState<AddPipeDraft>(() => ({
    ...createRuleDraft(),
    ownerId: parentId ?? null, name: "", description: "", icon: "pipe", priority: 0, capacity: "",
  }));
  const [formVersion, setFormVersion] = useState(0);
  const [activeStep, setActiveStep] = useState(parentId ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const validationTime = useRuleClock(draft.selectedRule === "cron" || draft.selectedRule === "self_destruct");
  const addPipe = useMutation(api.pipes.addPipe);
  const owner = pipes.find(pipe => pipe.id === draft.ownerId);
  const hasChildren = owner ? (childrenByParent.get(owner.id)?.length ?? 0) > 0 : false;
  const willRemoveSpentCapValues = owner && !hasChildren && (owner.capacity > 0 || owner.spent > 0);
  const valid = !!owner && validatePipeName(draft.name) === undefined && validatePipeCapacity(draft.capacity) === undefined && validateRuleDraft(draft, validationTime) === undefined;

  async function handleSubmit(now: number) {
    if (!valid || !owner || loading) return;
    const ruleError = validateRuleDraft(draft, now);
    if (ruleError) { setSubmitError(ruleError); return; }
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
        ...(draft.selectedRule === "none" ? {} : { ruleConfig: ruleConfigurationFromDraft(draft) }),
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    if (loading) return;
    setDraft({
      ...createRuleDraft(),
      ownerId: draft.ownerId, name: "", description: "", icon: "pipe", priority: 0, capacity: "",
    });
    setActiveStep(draft.ownerId ? 1 : 0);
    setSubmitError(undefined);
    setFormVersion(version => version + 1);
  }

  function handleChange(next: Partial<AddPipeDraft>) {
    setDraft((previous) => mergeRuleDraft(previous, next));
    // This is an interaction, not an effect: Back must stay on the owner step.
    if (activeStep === 0 && pipes.some(pipe => pipe.id === next.ownerId)) setActiveStep(1);
  }

  return (
    <View className="gap-4" style={{ flexShrink: 1 }}>
      <Form
        key={formVersion}
        form={buildAddPipeForm(pipes, loading, isLoading, draft, validationTime)}
        value={draft}
        onChange={handleChange}
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
        warnings={owner || submitError ? <View className="gap-1">
          {owner ? <>
            {willRemoveSpentCapValues ? (
              <View className="bg-warning/10 border border-warning/30 rounded-xl px-3 py-1">
                <Text className="text-warning text-sm">Creating a child will remove current capacity and spent values.</Text>
              </View>
            ) : null}
            {!hasChildren ? (
              <View className="bg-warning/10 border border-warning/30 rounded-xl px-3 py-1">
                <Text className="text-warning text-sm">
                  Adding a pipe removes the ability to add transactions from this pipe. All transactions should happen from a childless pipe.
                </Text>
              </View>
            ) : null}
            {owner.rule ? (
              <View className="bg-warning/10 border border-warning/30 rounded-xl px-3 py-1">
                <Text className="text-warning text-sm">
                  The owner pipe&apos;s current rule will be removed. Add rules directly to its children instead.
                </Text>
              </View>
            ) : null}
          </> : null}
          {submitError ? <Text accessibilityRole="alert" className="text-sm text-error">{submitError}</Text> : null}
        </View> : undefined}
        actions={<FormActionRow onClear={handleClear} clearDisabled={loading}>
          <Button title="Submit" icon="add" variant="outline" onPress={() => void handleSubmit(Date.now())} loading={loading} disabled={!valid} />
        </FormActionRow>}
      />
    </View>
  );
}
