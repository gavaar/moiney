import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@ui/Button";
import { Form, FormActionRow, type FormPage } from "@ui/Form";
import type { OnDismissStateChange } from "@ui/Form/use-form-dismissal";
import { safeIconName } from "@ui/Icon";
import { useAlert } from "@ui/Alert";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { PipeModel } from "@features/pipes/data/pipes";
import { useRuleClock } from "@features/pipes/rules/use-rule-clock";
import { useOptionalEventHistoryCache } from "@features/transactions/cache/EventHistoryCacheContext";
import { buildPipeForm, type PipeFormValues } from "./pipe-form.config";
import { parsePipeKind, PIPE_KINDS } from "@features/pipes/rules/config";
import { changePipeSession, createPipeSession, readPipeSession, resetPipeSession } from "./pipe-session";
import { preparePipeSubmission } from "./pipe-form-policy";

export type PipeFormProps = ({ mode: "create"; parentId?: Id<"pipes">; typePickerInitiallyExpanded?: boolean } | { mode: "edit"; pipe: PipeModel; initialStep?: number }) & {
  onClose: () => void;
  onDismissStateChange?: OnDismissStateChange;
};

function buildWarnings(owner: PipeModel | undefined, all: PipeModel[]) {
  const warnings: string[] = [];
  if (!owner) return warnings;

  const ownerContingencyPipe = all.find(item => item.id === owner.contingencyPipeId);
  const ownerContingentPipes = all.filter(item => item.contingencyPipeId === owner.id);
  const ownerNoCurrentChildren = all.find(item => item.parentId === owner.id) === undefined;

  if (ownerNoCurrentChildren) {
    warnings.push(`This pipe will become an intermediate pipe.
It will group and allocate money to it's children, but won't run any rules itself.`);
    warnings.push(`Adding a child turns '${owner.name}' into an intermediate pipe.
It will lose its ability to record expenses, send transfers, or run its own settlement rule.`);
    warnings.push(`After submit '${owner.name}' will be settled and leftover values will cascade to the new child, returning leftovers to parent`);

    if (ownerContingencyPipe) {
      warnings.push(`The owner will lose it's protection from '${ownerContingencyPipe.name}'. If you require this from the child, add a contingency to it.`);
    }

    if (ownerContingentPipes.length > 0) {
      warnings.push(`'${owner.name}' won't protect ${ownerContingentPipes.map(pipe => `'${pipe.name}'`).join(", ")} anymore.
Check the mentioned pipe${ownerContingentPipes.length === 1 ? "" : "s"} to add a new protection`);
    }
  }

  return warnings;
}

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
  const warnings = policy.mode === "create-inner" ? buildWarnings(owner, all) : [];
  const warningKey = JSON.stringify([draft.ownerId, warnings]);
  const [acknowledgement, setAcknowledgement] = useState({ key: warningKey, checked: false });
  // Acknowledgement belongs to these consequences, not to a previously visited owner.
  if (acknowledgement.key !== warningKey) setAcknowledgement({ key: warningKey, checked: false });
  const warningsAcknowledged = acknowledgement.key === warningKey && acknowledgement.checked;
  const needsAcknowledgement = warnings.length > 0 && !warningsAcknowledged;
  const { root, canRun } = policy;
  const submission = preparePipeSubmission(draft, context, validationTime);
  const valid = submission.status !== "invalid";

  useEffect(() => { onDismissStateChange?.(hasUnsavedChanges, busy); }, [hasUnsavedChanges, busy, onDismissStateChange]);

  function handleChange(next: Partial<PipeFormValues>) {
    const { warningsAcknowledged, ...fields } = next;
    if (warningsAcknowledged !== undefined) setAcknowledgement({ key: warningKey, checked: warningsAcknowledged });
    const normalized = { ...fields, kind: fields.kind == null ? fields.kind : parsePipeKind(fields.kind) };
    setSession(previous => changePipeSession(previous, normalized, context));
    setSubmitError(undefined);
  }

  function reset() {
    if (busy) return;
    setSession(previous => resetPipeSession(previous, context));
    setAcknowledgement({ key: warningKey, checked: false });
    setSubmitError(undefined);
    setFormVersion(version => version + 1);
  }

  async function submit(now: number) {
    if (busy || needsAcknowledgement) return;
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
  const pages: FormPage<PipeFormValues>[] = [
    ...buildPipeForm({
      pipes,
      disabled: busy,
      loading: isLoading,
      draft,
      now: validationTime,
      policy,
      typePickerInitiallyExpanded: props.mode === "create" && props.typePickerInitiallyExpanded === true,
    }),
  ];
  if (warnings.length) pages.push({
    key: 2,
    warnings,
    rows: [[{ key: "warningsAcknowledged", input: { type: "checkbox", checkboxLabel: "I understand", disabled: busy } }]],
  });

  return <View className="gap-4" style={{ flexShrink: 1 }}>
    <Form key={formVersion}
      pages={pages}
      value={{ ...draft, contingencyPipeId: draft.contingencyPipeId ?? "none", warningsAcknowledged }} onChange={handleChange}
      navigationStart={editing ? props.initialStep ?? 1 : 0}
      header={{
        title: pipe ? pipe.name : root ? `Create ${draft.kind === null ? undefined : PIPE_KINDS[draft.kind].title}` : headerPipe?.name ?? "Create pipe",
        icon: headerPipe ? safeIconName(headerPipe.icon) : "pipe",
      }}
      actions={<View className="gap-1">
        <FormActionRow onClear={reset} clearDisabled={busy} clearLabel={editing ? "Reset changes" : "Clear form"}
          clearIcon={editing ? "restore" : "eraser"}>
          <View className="flex-row flex-wrap justify-end gap-2 flex-1">
            {canRun ? <Button title="Run now" icon="water-outline" variant="secondary" disabled={hasUnsavedChanges || !valid || busy} onPress={() => void runNow()} /> : null}
            <Button title="Submit" icon={editing ? "checkmark" : "add"} variant="outline" onPress={() => void submit(Date.now())} loading={busy}
              disabled={submission.status !== "ready" || needsAcknowledgement} />
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
