import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { parseMoney } from "@domain/money";
import { previewChildContingencyOptions, prepareContingencyEligibility } from "@domain/pipes/contingencyEligibility";
import { colors } from "@/lib/styles";
import { Button } from "@ui/Button";
import { Form, FormActionRow } from "@ui/Form";
import { Icon, safeIconName } from "@ui/Icon";
import { useAlert } from "@ui/Alert";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { PipeModel } from "@features/pipes/data/pipes";
import { mergeRuleDraft, ruleConfigurationFromDraft, ruleDraftValues, validateRuleDraft } from "@features/pipes/rules/rule-form";
import { useRuleClock } from "@features/pipes/rules/use-rule-clock";
import { useOptionalEventHistoryCache } from "@features/transactions/cache/EventHistoryCacheContext";
import { buildPipeForm, validatePipeCapacity, validatePipeName } from "./pipe-form.config";
import { changePipeEdits, createPipeDraft, isPipeDraftDirty, pipeUpdateFromDraft, ruleDisallowsContingency, type PipeDraft } from "./pipe-draft";

export type PipeFormProps = ({ mode: "create"; parentId?: Id<"pipes"> } | { mode: "edit"; pipe: PipeModel; initialStep?: number }) & {
  onClose: () => void;
  onDismissStateChange?: (dirty: boolean, busy: boolean) => void;
};

export function PipeForm(props: PipeFormProps) {
  const { onClose, onDismissStateChange } = props;
  const { allPipes, isLoading } = usePipeCatalog();
  const all = allPipes ?? [];
  const pipes = all.filter(pipe => !pipe.deletionJobId);
  const pipe = props.mode === "edit" ? props.pipe : undefined;
  const editing = props.mode === "edit";
  const parentId = props.mode === "create" ? props.parentId : undefined;
  const [initialDraft] = useState(() => createPipeDraft(pipe, parentId ?? null));
  const [edits, setEdits] = useState<Partial<PipeDraft>>({});
  const [creationDraft, setCreationDraft] = useState(initialDraft);
  const baseline = editing ? createPipeDraft(pipe) : initialDraft;
  const draft = editing ? { ...baseline, ...edits } : creationDraft;
  const [formVersion, setFormVersion] = useState(0);
  const [activeStep, setActiveStep] = useState(props.mode === "edit" ? props.initialStep ?? 1 : parentId ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const validationTime = useRuleClock(draft.selectedRule === "cron" || draft.selectedRule === "self_destruct");
  const addPipe = useMutation(api.pipes.addPipe);
  const updatePipe = useMutation(api.pipes.updatePipe);
  const executePipeRuleNow = useMutation(api.pipes.executePipeRuleNow);
  const historyCache = useOptionalEventHistoryCache();
  const alert = useAlert();
  const owner = pipes.find(item => item.id === draft.ownerId);
  const leaf = !pipe || !all.some(item => item.parentId === pipe.id);
  const dirty = isPipeDraftDirty(draft, baseline, leaf);
  const topology = all.map(item => ({ id: item.id, parentId: item.parentId, rule: item.rule,
    contingencyPipeId: item.contingencyPipeId, blocked: Boolean(item.deletionJobId) }));
  const intendedRule = ruleDraftValues(draft).selectedRule;
  const rule = intendedRule === "none" ? undefined : intendedRule;
  const eligibleIds = pipe
    ? prepareContingencyEligibility(topology.map(item => item.id === pipe.id ? { ...item, rule } : item))(pipe.id)
    : owner ? previewChildContingencyOptions(topology, owner.id, rule) : [];
  const contingencyOptions = all.filter(item => eligibleIds.includes(item.id));
  const invalidContingency = draft.contingencyPipeId !== null && !eligibleIds.some(id => id === draft.contingencyPipeId);
  const capacityError = leaf ? validatePipeCapacity(draft.capacity, editing) : undefined;
  const valid = (editing ? Boolean(pipe && !pipe.deletionJobId) : Boolean(owner)) &&
    validatePipeName(draft.name) === undefined && capacityError === undefined &&
    Number.isSafeInteger(draft.priority) && draft.priority >= 0 &&
    (!leaf || validateRuleDraft(draft, validationTime) === undefined && !invalidContingency);
  const canRun = editing && leaf && draft.selectedRule !== "cron" && draft.selectedRule !== "self_destruct";

  useEffect(() => { onDismissStateChange?.(dirty, busy); }, [dirty, busy, onDismissStateChange]);

  function handleChange(next: Partial<PipeDraft>) {
    // Select's explicit "none" item represents a cleared contingency in the draft.
    const normalized = { ...next, ...(next.contingencyPipeId === "none" ? { contingencyPipeId: null } : {}) };
    if (editing) setEdits(previous => changePipeEdits(baseline, previous, normalized));
    else setCreationDraft(previous => {
      const merged = mergeRuleDraft(previous, normalized);
      if (merged.selectedRule !== previous.selectedRule && ruleDisallowsContingency(merged.selectedRule)) merged.contingencyPipeId = null;
      return merged;
    });
    // Auto-advance is an interaction, not an effect: Back must stay on Owner.
    if (!editing && activeStep === 0 && pipes.some(item => item.id === next.ownerId)) setActiveStep(1);
    setSubmitError(undefined);
  }

  function reset() {
    if (busy) return;
    if (editing) setEdits({});
    else {
      setCreationDraft(createPipeDraft(undefined, draft.ownerId));
      setActiveStep(draft.ownerId ? 1 : 0);
    }
    setSubmitError(undefined);
    setFormVersion(version => version + 1);
  }

  async function submit(now: number) {
    if (!valid || busy) return;
    const error = leaf ? validateRuleDraft(draft, now) : undefined;
    if (error) { setSubmitError(error); if (editing) alert.error(error); return; }
    setBusy(true);
    setSubmitError(undefined);
    try {
      if (pipe) await updatePipe(pipeUpdateFromDraft(pipe, draft, all, leaf));
      else if (owner) await addPipe({ parentId: owner.id, name: draft.name.trim(), description: draft.description || undefined,
        icon: draft.icon || "pipe", priority: draft.priority, capacity: draft.capacity ? parseMoney(draft.capacity) : 0,
        ...(draft.selectedRule === "none" ? {} : { ruleConfig: ruleConfigurationFromDraft(draft) }),
        ...(draft.contingencyPipeId ? { contingencyPipeId: contingencyOptions.find(item => item.id === draft.contingencyPipeId)!.id } : {}),
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSubmitError(message);
      if (editing) alert.error(message);
    } finally { setBusy(false); }
  }

  async function runNow() {
    if (!pipe || !canRun || dirty || !valid || busy) return;
    setBusy(true);
    try {
      await executePipeRuleNow({ pipeId: pipe.id });
      void historyCache?.invalidateHistory().catch(() => undefined);
      alert.success("Rule executed");
      onClose();
    } catch (error) { alert.error(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  const headerPipe = editing ? owner ?? pipe : owner;
  const hasOwnerChildren = owner && all.some(item => item.parentId === owner.id);
  const warnings = !editing && owner ? [
    !hasOwnerChildren && (owner.capacity > 0 || owner.spent > 0) ? "Creating a child will remove current capacity and spent values." : undefined,
    !hasOwnerChildren ? "Adding a pipe removes the ability to add transactions from this pipe. All transactions should happen from a childless pipe." : undefined,
    owner.rule ? "The owner pipe's current rule will be removed. Add rules directly to its children instead." : undefined,
  ].filter(message => message !== undefined) : [];

  return <View className="gap-4" style={{ flexShrink: 1 }}>
    <Form key={formVersion}
      form={buildPipeForm({ pipes, disabled: busy, loading: isLoading, draft, now: validationTime, editing, leaf,
        allowSelfDestruct: !editing || Boolean(pipe?.parentId), contingencyOptions, invalidContingency,
        removalPending: Boolean(pipe?.contingencyPipeId && ruleDisallowsContingency(draft.selectedRule)) })}
      value={{ ...draft, contingencyPipeId: draft.contingencyPipeId ?? "none" }} onChange={handleChange}
      activeStep={activeStep} onStepChange={step => { if (!busy) setActiveStep(step); }}
      header={<View className="flex-row items-center gap-2 border-b border-muted/20 p-2"
        accessibilityRole="header" accessibilityLabel={headerPipe?.name ?? "Select owner pipe"}>
        <Icon name={headerPipe ? safeIconName(headerPipe.icon) : "pipe-disconnected"} size={24} color={colors.muted} />
        <Text className="flex-1 text-md font-medium text-muted" numberOfLines={1}>{headerPipe?.name ?? "Select owner pipe"}</Text>
      </View>}
      warnings={warnings.length || submitError || canRun && dirty ? <View className="gap-1">
        {warnings.map(message => <View key={message} className="bg-warning/10 border border-warning/30 rounded-xl px-3 py-1">
          <Text className="text-warning text-sm">{message}</Text>
        </View>)}
        {canRun && dirty ? <Text className="text-sm text-muted">Save changes before running.</Text> : null}
        {submitError ? <Text accessibilityRole="alert" className="text-sm text-error">{submitError}</Text> : null}
      </View> : undefined}
      actions={<FormActionRow onClear={reset} clearDisabled={busy} clearLabel={editing ? "Reset changes" : "Clear form"}
        clearIcon={editing ? "restore" : "eraser"}>
        <View className="flex-row flex-wrap justify-end gap-2 flex-1">
          {canRun ? <Button title="Run now" icon="water-outline" variant="secondary" disabled={dirty || !valid || busy} onPress={() => void runNow()} /> : null}
          <Button title="Submit" icon={editing ? "checkmark" : "add"} variant="outline" onPress={() => void submit(Date.now())} loading={busy}
            disabled={!valid || editing && !dirty} />
        </View>
      </FormActionRow>}
    />
  </View>;
}
