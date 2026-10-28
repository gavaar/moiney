import type { FunctionArgs } from "convex/server";
import type { api } from "@convex/_generated/api";
import { parseMoney } from "@domain/money";
import { previewChildContingencyOptions, prepareContingencyEligibility } from "@domain/pipes/contingencyEligibility";
import type { PipeModel } from "@features/pipes/data/pipes";
import { ruleConfigurationFromDraft, ruleDraftValues, validateRuleDraft } from "@features/pipes/rules/rule-draft";
import { hasRuleDiff } from "@features/pipes/rules/helpers";
import { safeIconName } from "@ui/Icon";
import { pipeRuleDraft, type PipeDraft } from "./pipe-draft";
import { isFeedKind } from "@features/pipes/rules/config";

export type PipeFormContext = { pipe?: PipeModel; pipes: readonly PipeModel[]; parentId?: string };
type PipeCommand =
  | { type: "update"; args: FunctionArgs<typeof api.pipes.updatePipe> }
  | { type: "addFeed"; args: FunctionArgs<typeof api.pipes.addFeed> }
  | { type: "addPipe"; args: FunctionArgs<typeof api.pipes.addPipe> };
type Submission = { status: "invalid"; error: string } | { status: "unchanged" } | { status: "ready"; command: PipeCommand };

export function validatePipeName(value: string, minimum = 3): string | undefined {
  if (!value.trim()) return "Name is required";
  if (value.trim().length < minimum) return `Name must be at least ${minimum} characters`;
}

export function validatePipeCapacity(value: string, required = false): string | undefined {
  if (!value) return required ? "Enter a valid capacity" : undefined;
  try { parseMoney(value); } catch { return "Enter a valid capacity"; }
}

export function validateOpeningMoney(value: string): string | undefined {
  if (!value) return undefined;
  try { if (parseMoney(value) >= 0) return undefined; } catch { /* Incomplete money input is not valid. */ }
  return "Enter a nonnegative amount";
}

export function eligibleContingencies(draft: PipeDraft, { pipe, pipes }: PipeFormContext): readonly PipeModel[] {
  if (isFeedKind(draft.kind) || !draft.kind) return [];
  const topology = pipes.map(item => ({
    id: item.id,
    parentId: item.parentId,
    rule: item.rule,
    contingencyPipeId: item.contingencyPipeId,
    blocked: Boolean(item.deletionJobId),
  }));
  const rule = draft.kind === "none" ? undefined : draft.kind;
  const eligible = pipe
    ? prepareContingencyEligibility(topology.map(item => item.id === pipe.id ? { ...item, rule } : item))(pipe.id)
    : draft.ownerId ? previewChildContingencyOptions(topology, draft.ownerId, rule) : [];
  return pipes.filter(item => eligible.includes(item.id));
}

export function pipeFormPolicy(draft: PipeDraft, context: PipeFormContext) {
  const { pipe, pipes, parentId } = context;
  const editing = Boolean(pipe);
  const root = pipe ? !pipe.parentId : isFeedKind(draft.kind);
  const leaf = !pipe || !pipes.some(item => item.parentId === pipe.id);
  const mode = editing
    ? root || !leaf
      ? "edit-details"
      : "edit-inner"
    : !draft.kind
      ? "unselected"
      : root
        ? "create-root"
        : "create-inner";
  const accountingEditable = mode === "edit-inner" || mode === "create-inner";
  const contingencyOptions = accountingEditable ? eligibleContingencies(draft, context) : [];
  return {
    mode,
    editing,
    root,
    accountingEditable,
    priorityEditable: !root && mode !== "unselected",
    nameMinimum: root ? 2 : 3,
    allowRootCreation: !parentId,
    hasFeed: pipes.some(item => !item.parentId && !item.deletionJobId),
    contingencyOptions,
    invalidContingency: draft.contingencyPipeId !== null && !contingencyOptions.some(item => item.id === draft.contingencyPipeId),
    canRun: editing && accountingEditable && draft.kind !== "cron" && draft.kind !== "self_destruct",
  };
}

export type PipeFormPolicy = ReturnType<typeof pipeFormPolicy>;

function pipeUpdateFromDraft(pipe: PipeModel, draft: PipeDraft, policy: PipeFormPolicy, contingency?: PipeModel): FunctionArgs<typeof api.pipes.updatePipe> {
  const command: FunctionArgs<typeof api.pipes.updatePipe> = { pipeId: pipe.id };
  if (draft.name.trim() !== pipe.name) command.name = draft.name.trim();
  if ((draft.icon || "pipe") !== safeIconName(pipe.icon)) command.icon = draft.icon || "pipe";
  const description = draft.description.trim() ? draft.description : undefined;
  if (draft.description !== (pipe.description ?? "")) command.description = description ?? null;
  if (policy.priorityEditable && draft.priority !== pipe.priority) command.priority = draft.priority;
  if (!policy.accountingEditable) return command;
  const capacity = parseMoney(draft.capacity);
  if (capacity !== pipe.capacity) command.capacity = capacity;
  const values = ruleDraftValues(pipeRuleDraft(draft));
  if (hasRuleDiff({
    pipe,
    selectedRule: values.selectedRule,
    isCron: values.selectedRule === "cron",
    capNumber: values.effectiveCron.capUpdateValue,
    interval: values.effectiveCron.interval,
    unit: values.effectiveCron.unit,
    starting: values.starting,
  })) command.ruleConfig = ruleConfigurationFromDraft(pipeRuleDraft(draft));
  if (draft.contingencyPipeId !== (pipe.contingencyPipeId ?? null)) {
    command.contingencyPipeId = contingency?.id ?? null;
  }
  return command;
}

/** Validate only the active form, then construct a command from those same fields. */
export function preparePipeSubmission(draft: PipeDraft, context: PipeFormContext, now: number): Submission {
  const { pipe, pipes } = context;
  const policy = pipeFormPolicy(draft, context);
  const invalid = (error: string): Submission => ({ status: "invalid", error });
  if (!draft.kind) return invalid("Pipe type is required");
  if (pipe?.deletionJobId) return invalid("This pipe is being deleted");
  const owner = pipes.find(item => item.id === draft.ownerId && !item.deletionJobId);
  if (!pipe && (policy.root ? !policy.allowRootCreation : !owner)) return invalid("Select an owner pipe");
  const nameError = validatePipeName(draft.name, policy.nameMinimum);
  if (nameError) return invalid(nameError);
  if (policy.priorityEditable && (!Number.isSafeInteger(draft.priority) || draft.priority < 0)) {
    return invalid("Enter a nonnegative whole priority");
  }
  if (policy.accountingEditable) {
    const error = validatePipeCapacity(draft.capacity, policy.editing) ?? validateRuleDraft(pipeRuleDraft(draft), now);
    if (error) return invalid(error);
    if (policy.invalidContingency) return invalid("Selected contingency is no longer eligible. Choose another or clear it.");
  }
  if (policy.mode === "create-root") {
    const error = validateOpeningMoney(draft.amount) ?? (draft.kind === "boiler" ? validateOpeningMoney(draft.contributed) : undefined);
    if (error) return invalid(error);
  }
  const contingency = policy.contingencyOptions.find(item => item.id === draft.contingencyPipeId);
  if (pipe) {
    const args = pipeUpdateFromDraft(pipe, draft, policy, contingency);
    return Object.keys(args).length === 1 ? { status: "unchanged" } : { status: "ready", command: { type: "update", args } };
  }
  if (policy.root) return {
    status: "ready",
    command: {
      type: "addFeed",
      args: {
        name: draft.name.trim(),
        icon: draft.icon || "pipe",
        description: draft.description || undefined,
        sourceType: draft.kind === "boiler" ? "boiler" : "feed",
        ...(draft.amount ? { initialFed: parseMoney(draft.amount) } : {}),
        ...(draft.kind === "boiler" && draft.contributed ? { contributedFed: parseMoney(draft.contributed) } : {}),
      },
    },
  };
  if (!owner) return invalid("Select an owner pipe");
  return {
    status: "ready",
    command: {
      type: "addPipe",
      args: {
        parentId: owner.id,
        name: draft.name.trim(),
        description: draft.description || undefined,
        icon: draft.icon || "pipe",
        priority: draft.priority,
        capacity: draft.capacity ? parseMoney(draft.capacity) : 0,
        ...(draft.kind === "none" ? {} : { ruleConfig: ruleConfigurationFromDraft(pipeRuleDraft(draft)) }),
        ...(contingency ? { contingencyPipeId: contingency.id } : {}),
      },
    },
  };
}
