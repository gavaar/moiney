import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@ui/Button";
import { Form, FormActionRow } from "@ui/Form";
import type { OnDismissStateChange } from "@ui/Form/use-form-dismissal";
import { safeIconName } from "@ui/Icon";
import { useAlert } from "@ui/Alert";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { PipeModel } from "@features/pipes/data/pipes";
import { useRuleClock } from "@features/pipes/rules/use-rule-clock";
import { useOptionalEventHistoryCache } from "@features/transactions/cache/EventHistoryCacheContext";
import { buildPipeForm, type PipeFormValues } from "./pipe-form.config";
import { parsePipeKind, PIPE_CHOICES } from "./pipe-kinds";
import { changePipeSession, createPipeSession, readPipeSession, resetPipeSession } from "./pipe-session";
import { preparePipeSubmission } from "./pipe-form-policy";

export type PipeFormProps = ({ mode: "create"; parentId?: Id<"pipes">; typePickerInitiallyExpanded?: boolean } | { mode: "edit"; pipe: PipeModel; initialStep?: number }) & {
  onClose: () => void;
  onDismissStateChange?: OnDismissStateChange;
};

export function PipeForm(props: PipeFormProps) {
  const { onClose, onDismissStateChange } = props;
  const { allPipes, isLoading } = usePipeCatalog();
  const all = allPipes ?? [];
  const pipes = all.filter(pipe => !pipe.deletionJobId);
  const pipe = props.mode === "edit" ? props.pipe : undefined;
  const editing = props.mode === "edit";
  const parentId = props.mode === "create" ? props.parentId : undefined;
  const context = { pipe, pipes: all, parentId };
  const [session, setSession] = useState(() => createPipeSession(pipe, parentId ?? null));
  const { draft, policy, hasUnsavedChanges, contingencyNotice } = readPipeSession(session, context);
  const [formVersion, setFormVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const validationTime = useRuleClock(draft.kind === "cron" || draft.kind === "self_destruct");
  const addPipe = useMutation(api.pipes.addPipe);
  const addFeed = useMutation(api.pipes.addFeed);
  const updatePipe = useMutation(api.pipes.updatePipe);
  const executePipeRuleNow = useMutation(api.pipes.executePipeRuleNow);
  const historyCache = useOptionalEventHistoryCache();
  const alert = useAlert();
  const owner = pipes.find(item => item.id === draft.ownerId);
  const { root, canRun } = policy;
  const submission = preparePipeSubmission(draft, context, validationTime);
  const valid = submission.status !== "invalid";

  useEffect(() => { onDismissStateChange?.(hasUnsavedChanges, busy); }, [hasUnsavedChanges, busy, onDismissStateChange]);

  function handleChange(next: Partial<PipeFormValues>) {
    const normalized = { ...next, kind: next.kind == null ? next.kind : parsePipeKind(next.kind) };
    setSession(previous => changePipeSession(previous, normalized, context));
    setSubmitError(undefined);
  }

  function reset() {
    if (busy) return;
    setSession(previous => resetPipeSession(previous, context));
    setSubmitError(undefined);
    setFormVersion(version => version + 1);
  }

  async function submit(now: number) {
    if (busy) return;
    const prepared = preparePipeSubmission(draft, context, now);
    if (prepared.status === "invalid") {
      setSubmitError(prepared.error);
      if (editing) alert.error(prepared.error);
      return;
    }
    if (prepared.status === "unchanged") return;
    setBusy(true);
    setSubmitError(undefined);
    try {
      const { command } = prepared;
      switch (command.type) {
        case "update": await updatePipe(command.args); break;
        case "addFeed": await addFeed(command.args); break;
        case "addPipe": await addPipe(command.args); break;
      }
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSubmitError(message);
      if (editing) alert.error(message);
    } finally { setBusy(false); }
  }

  async function runNow() {
    if (!pipe || !canRun || hasUnsavedChanges || !valid || busy) return;
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
  const warnings = !editing && !root && draft.kind && owner ? [
    !hasOwnerChildren ? `Adding the first child turns ${owner.name} into an intermediate pipe. It groups and allocates money to its children, but can no longer record expenses, send transfers, or run its own settlement rule.` : undefined,
    !hasOwnerChildren ? "The owner's balance is settled, then its local capacity and spending are cleared before allocating money to children." : undefined,
    owner.rule ? "The owner pipe's current rule and options will be removed. Add settlement behavior to its children instead." : undefined,
    !hasOwnerChildren && (owner.contingencyPipeId || all.some(item => item.contingencyPipeId === owner.id)) ? "The owner's contingency and any coverage it provides to other pipes will be removed." : undefined,
  ].filter(message => message !== undefined) : [];

  return <View className="gap-4" style={{ flexShrink: 1 }}>
    <Form key={formVersion}
      pages={buildPipeForm({
        pipes,
        disabled: busy,
        loading: isLoading,
        draft,
        now: validationTime,
        policy,
        typePickerInitiallyExpanded: props.mode === "create" && props.typePickerInitiallyExpanded === true,
      })}
      value={{ ...draft, contingencyPipeId: draft.contingencyPipeId ?? "none" }} onChange={handleChange}
      navigationStart={editing ? props.initialStep ?? 1 : 0}
      header={{
        title: pipe ? pipe.name : root ? `Create ${PIPE_CHOICES.find(item => item.id === draft.kind)?.title}` : headerPipe?.name ?? "Create pipe",
        icon: headerPipe ? safeIconName(headerPipe.icon) : "pipe",
      }}
      warnings={warnings}
      actions={<View className="gap-1">
        <FormActionRow onClear={reset} clearDisabled={busy} clearLabel={editing ? "Reset changes" : "Clear form"}
          clearIcon={editing ? "restore" : "eraser"}>
          <View className="flex-row flex-wrap justify-end gap-2 flex-1">
            {canRun ? <Button title="Run now" icon="water-outline" variant="secondary" disabled={hasUnsavedChanges || !valid || busy} onPress={() => void runNow()} /> : null}
            <Button title="Submit" icon={editing ? "checkmark" : "add"} variant="outline" onPress={() => void submit(Date.now())} loading={busy}
              disabled={submission.status !== "ready"} />
          </View>
        </FormActionRow>
        {canRun && hasUnsavedChanges ? <Text className="text-sm text-muted">
          {submission.status === "ready" ? "Save changes before running." : "Save the edited type, or reset changes before running."}
        </Text> : null}
        {submitError ? <Text accessibilityRole="alert" className="text-sm text-error">{submitError}</Text> : null}
        {contingencyNotice ? <Text className="text-sm text-warning">{contingencyNotice}</Text> : null}
      </View>}
    />
  </View>;
}
