import type { PipeModel } from "@features/pipes/data/pipes";
import { createRuleDraft, mergeRuleDraft } from "@features/pipes/rules/rule-draft";
import { createPipeDraft, type PipeDraft } from "./pipe-draft";
import { isFeedKind, PIPE_CHOICES, type PipeKind } from "./pipe-kinds";
import { eligibleContingencies, pipeFormPolicy, type PipeFormContext } from "./pipe-form-policy";

const OPTION_KEYS = ["capValue", "interval", "unit", "pacing", "starting", "deletionDate", "contingencyPipeId"] as const;
const COMMON_KEYS = ["ownerId", "name", "description", "icon", "priority", "capacity", "amount", "contributed"] as const;
type Options = Pick<PipeDraft, typeof OPTION_KEYS[number]>;
type CommonFields = Pick<PipeDraft, typeof COMMON_KEYS[number]>;
type Variant = { initial: Options; edits: Partial<Options> };
type Session = {
  initial: PipeDraft;
  selectedKind?: PipeKind;
  common: Partial<CommonFields>;
  variants: Partial<Record<PipeKind, Variant>>;
  contingencyNotice?: string;
};

function sameValue(left: unknown, right: unknown) {
  return left instanceof Date && right instanceof Date ? left.getTime() === right.getTime() : left === right;
}

function optionKeys(draft: PipeDraft): readonly (keyof Options)[] {
  if (isFeedKind(draft.kind)) return [];
  if (draft.kind === "self_destruct") return ["deletionDate", "contingencyPipeId"];
  if (draft.kind === "none") return ["contingencyPipeId"];
  if (draft.kind === "cron") return OPTION_KEYS.filter(key => key !== "deletionDate");
  return ["capValue", "contingencyPipeId"];
}

export function createPipeSession(pipe?: PipeModel, ownerId: string | null = null): Session {
  return { initial: createPipeDraft(pipe, ownerId), common: {}, variants: {} };
}

function liveDraft(session: Session, pipe?: PipeModel) {
  return pipe ? createPipeDraft(pipe) : session.initial;
}

function optionsFromDraft({ capValue, interval, unit, pacing, starting, deletionDate, contingencyPipeId }: Options): Options {
  return { capValue, interval, unit, pacing, starting, deletionDate, contingencyPipeId };
}

function variantBase(session: Session, kind: PipeKind, live: PipeDraft): Options {
  return kind === live.kind ? optionsFromDraft(live) : session.variants[kind]?.initial ??
    optionsFromDraft({ ...createRuleDraft(), contingencyPipeId: null });
}

function sessionDraft(session: Session, pipe?: PipeModel): PipeDraft {
  const live = liveDraft(session, pipe);
  const kind = session.selectedKind === undefined ? live.kind : session.selectedKind;
  const options = kind ? { ...variantBase(session, kind, live), ...session.variants[kind]?.edits } : {};
  const draft: PipeDraft = {
    ...live, ...session.common, ...options, kind,
  };
  if (isFeedKind(kind) || kind === "instant_settlement") draft.contingencyPipeId = null;
  return draft;
}

/** Untouched fields follow live data, including when live data adopts a locally edited type. */
export function readPipeSession(session: Session, context: PipeFormContext) {
  const live = liveDraft(session, context.pipe);
  const draft = sessionDraft(session, context.pipe);
  const { kind } = draft;
  const policy = pipeFormPolicy(draft, context);
  const activeDirty = kind !== live.kind || COMMON_KEYS.some(key =>
    (key !== "capacity" || policy.accountingEditable) && !sameValue(draft[key], live[key])) ||
    policy.accountingEditable && optionKeys(draft).some(key => !sameValue(draft[key], live[key]));
  const inactiveEdits = PIPE_CHOICES.some(({ id: variantKind }) => {
    const variant = session.variants[variantKind];
    if (variantKind === kind || !variant) return false;
    const base = variantBase(session, variantKind, live);
    const saved = { ...draft, ...base, ...variant.edits, kind: variantKind };
    return optionKeys(saved).some(key => !sameValue(saved[key], base[key]));
  });
  return {
    draft,
    policy,
    hasUnsavedChanges: activeDirty || inactiveEdits,
    contingencyNotice: session.contingencyNotice,
  };
}

function recordField<T, K extends keyof T>(edits: Partial<T>, key: K, value: T[K], baseline: T) {
  if (sameValue(value, baseline[key])) delete edits[key];
  else edits[key] = value;
}

/** Owns the complete type/owner transition, including restoring and checking contingency. */
export function changePipeSession(session: Session, change: Partial<PipeDraft>, context: PipeFormContext): Session {
  const { pipe } = context;
  const live = liveDraft(session, pipe);
  const previous = sessionDraft(session, pipe);
  // Form emits all configured fields, not just the changed field. Do not turn
  // echoed outgoing options into edits of the newly selected type.
  const normalized = { ...change, ...(change.contingencyPipeId === "none" ? { contingencyPipeId: null } : {}) };
  const updates: Partial<PipeDraft> = {};
  function copyChange<K extends keyof PipeDraft>(key: K) {
    const value = normalized[key];
    if (value !== undefined && !sameValue(value, previous[key])) updates[key] = value;
  }
  for (const key of [...COMMON_KEYS, ...OPTION_KEYS, "kind"] as const) copyChange(key);
  const next: Session = { ...session, common: { ...session.common }, variants: { ...session.variants } };
  const kind = updates.kind;
  const switching = kind != null;
  if (kind != null) {
    if (previous.kind) next.variants[previous.kind] = {
      initial: variantBase(session, previous.kind, live),
      edits: session.variants[previous.kind]?.edits ?? {},
    };
    next.selectedKind = kind === live.kind ? undefined : kind;
    next.variants[kind] ??= {
      initial: kind === live.kind ? optionsFromDraft(live) : optionsFromDraft({ ...createRuleDraft(), contingencyPipeId: previous.contingencyPipeId }),
      edits: {},
    };
  }
  const current = sessionDraft(next, pipe);
  const candidate = mergeRuleDraft(current, updates);
  for (const key of COMMON_KEYS) {
    if (!sameValue(candidate[key], previous[key])) recordField(next.common, key, candidate[key], live);
  }
  if (candidate.kind) {
    const variant = next.variants[candidate.kind] ?? { initial: optionsFromDraft(current), edits: {} };
    const edits = { ...variant.edits };
    const base = variantBase(next, candidate.kind, live);
    for (const key of OPTION_KEYS) {
      if (!sameValue(candidate[key], current[key])) recordField(edits, key, candidate[key], base);
    }
    if (isFeedKind(candidate.kind) || candidate.kind === "instant_settlement") candidate.contingencyPipeId = null;
    if ((switching || candidate.ownerId !== previous.ownerId) && candidate.contingencyPipeId &&
      !eligibleContingencies(candidate, context).some(item => item.id === candidate.contingencyPipeId)) {
      candidate.contingencyPipeId = null;
      recordField(edits, "contingencyPipeId", null, base);
      next.contingencyNotice = "Contingency cleared because it isn't available under this owner.";
    } else if (change.contingencyPipeId !== undefined && candidate.contingencyPipeId !== previous.contingencyPipeId) {
      next.contingencyNotice = undefined;
    }
    next.variants[candidate.kind] = { ...variant, edits };
  }
  return next;
}

export function resetPipeSession(session: Session, context: PipeFormContext): Session {
  return createPipeSession(context.pipe, sessionDraft(session, context.pipe).ownerId);
}
