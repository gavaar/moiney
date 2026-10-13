import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  allocateContingencyCoverage,
  calculatePipeRulePatch,
  recalculatePipes,
} from "../../../domain/pipes";
import { countDueCronOccurrences } from "../../../domain/scheduling";
import { MAX_PIPES_PER_USER } from "../constants";
import { recordSettlementHistory } from "../events/settlement";
import { assertAmountLimit } from "../../../domain/money";
import { ConvexError } from "convex/values";
import { preparePipeContingencyEligibility, type AppliedContingencyCoverage } from "./contingency";

const CRON_CANDIDATE_PAGE_SIZE = 500;
// Four maximum-size user snapshots keep the aggregate read/write set bounded.
const MAX_CRON_SNAPSHOT_PIPE_COUNT = MAX_PIPES_PER_USER * 4;

export type RunDueCronRulesArgs = {
  now?: number;
  cursor?: string;
  pendingPipeIds?: Id<"pipes">[];
};

export type CronContinuation = {
  now: number;
  cursor?: string;
  pendingPipeIds?: Id<"pipes">[];
};

type ScheduleCronContinuation = (
  ctx: MutationCtx,
  args: CronContinuation,
) => Promise<unknown>;

type CronAccountingPatch = Partial<
  Pick<
    Doc<"pipes">,
    | "fed"
    | "spent"
    | "pendingFedAdjustment"
    | "capacity"
    | "cronNextDate"
  >
>;

type PipeRootIndex = {
  originalById: Map<Id<"pipes">, Doc<"pipes">>;
  rootByPipeId: Map<Id<"pipes">, Id<"pipes">>;
  pipesByRoot: Map<Id<"pipes">, Doc<"pipes">[]>;
};

function groupCandidatesByUser(
  candidates: Doc<"pipes">[],
): Map<Id<"users">, Doc<"pipes">[]> {
  const grouped = new Map<Id<"users">, Doc<"pipes">[]>();
  for (const candidate of candidates) {
    const userCandidates = grouped.get(candidate.userId) ?? [];
    userCandidates.push(candidate);
    grouped.set(candidate.userId, userCandidates);
  }
  return grouped;
}

function indexPipesByRoot(pipes: Doc<"pipes">[]): PipeRootIndex {
  const originalById = new Map(pipes.map((pipe) => [pipe._id, pipe]));
  const rootByPipeId = new Map<Id<"pipes">, Id<"pipes">>();

  const rootOf = (pipeId: Id<"pipes">): Id<"pipes"> => {
    const cached = rootByPipeId.get(pipeId);
    if (cached) return cached;

    const path: Id<"pipes">[] = [];
    const visited = new Set<Id<"pipes">>();
    let currentId = pipeId;
    while (!visited.has(currentId)) {
      const knownRoot = rootByPipeId.get(currentId);
      if (knownRoot) {
        currentId = knownRoot;
        break;
      }

      visited.add(currentId);
      path.push(currentId);
      const current = originalById.get(currentId);
      if (!current?.parentId || !originalById.has(current.parentId)) break;
      currentId = current.parentId;
    }

    for (const id of path) rootByPipeId.set(id, currentId);
    return currentId;
  };

  const pipesByRoot = new Map<Id<"pipes">, Doc<"pipes">[]>();
  for (const pipe of pipes) {
    const rootId = rootOf(pipe._id);
    const rootPipes = pipesByRoot.get(rootId) ?? [];
    rootPipes.push(pipe);
    pipesByRoot.set(rootId, rootPipes);
  }

  return { originalById, rootByPipeId, pipesByRoot };
}

function buildAccountingPatch(
  before: Doc<"pipes">,
  after: Doc<"pipes">,
): CronAccountingPatch {
  const patch: CronAccountingPatch = {};
  for (const field of [
    "fed",
    "spent",
    "pendingFedAdjustment",
    "capacity",
    "cronNextDate",
  ] as const) {
    if (before[field] !== after[field]) patch[field] = after[field];
  }
  return patch;
}

function countDueOccurrences(pipe: Doc<"pipes">, now: number): number {
  if (
    pipe.rule !== "cron" ||
    pipe.cronNextDate == null ||
    !Number.isFinite(pipe.cronNextDate) ||
    !pipe.cronInterval ||
    !Number.isSafeInteger(pipe.cronInterval.interval) ||
    pipe.cronInterval.interval <= 0
  ) {
    return 0;
  }
  return countDueCronOccurrences(
    pipe.cronNextDate,
    pipe.cronInterval.interval,
    pipe.cronInterval.unit,
    now,
  );
}

type CronSettlement = { before: Doc<"pipes">; after: Doc<"pipes">; coverage?: AppliedContingencyCoverage };

function calculateUserCronPlan(
  pipes: Doc<"pipes">[],
  now: number,
): { patches: Map<Id<"pipes">, CronAccountingPatch>; settlements: CronSettlement[] } {
  const { originalById, rootByPipeId, pipesByRoot } = indexPipesByRoot(pipes);
  const workingById = new Map(
    pipes.map((pipe) => [pipe._id, { ...pipe } as Doc<"pipes">]),
  );
  const blockedRoots = new Set<Id<"pipes">>();
  for (const [rootId, rootPipes] of pipesByRoot) {
    if (rootPipes.some((pipe) => pipe.deletionJobId)) {
      blockedRoots.add(rootId);
    }
  }

  const affectedRoots = new Set<Id<"pipes">>();
  const settlements: CronSettlement[] = [];
  const eligible = preparePipeContingencyEligibility(pipes);
  // Query pages are only user triggers. The bounded snapshot owns complete groups.
  const due = pipes.filter(pipe => countDueOccurrences(pipe, now) > 0 && !blockedRoots.has(rootByPipeId.get(pipe._id)!))
    .sort((a, b) => a.cronNextDate! - b.cronNextDate! || a.priority - b.priority || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0));
  const groups = new Map<string, Doc<"pipes">[]>();
  for (const pipe of due) {
    const key = `${pipe.cronNextDate}:${pipe.priority}`;
    const group = groups.get(key) ?? [];
    group.push(pipe);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const claimsByDonor = new Map<Id<"pipes">, Doc<"pipes">[]>();
    for (const pipe of group) {
      const donorId = pipe.contingencyPipeId;
      if (!donorId || !eligible(pipe._id).includes(donorId)) continue;
      const claims = claimsByDonor.get(donorId) ?? [];
      claims.push(workingById.get(pipe._id)!);
      claimsByDonor.set(donorId, claims);
    }
    const coverages = new Map<Id<"pipes">, AppliedContingencyCoverage>();
    for (const [donorId, claims] of claimsByDonor) {
      const allocated = allocateContingencyCoverage(claims.map(pipe => ({ sourceId: pipe._id, capacity: pipe.capacity, spent: pipe.spent, rule: pipe.rule })), workingById.get(donorId)!);
      for (const { sourceId, coverageCents } of allocated) {
        const before = workingById.get(donorId)!;
        const after = { ...before, spent: assertAmountLimit(before.spent + coverageCents) };
        assertAmountLimit(workingById.get(sourceId)!.spent - coverageCents);
        workingById.set(donorId, after);
        coverages.set(sourceId, { amountCents: coverageCents, before, after });
      }
    }
    // All coverage in this group precedes rule execution, including a due donor's.
    for (const pipe of group) {
      const current = workingById.get(pipe._id)!;
      const coverage = coverages.get(pipe._id);
      const covered = coverage ? { ...current, spent: current.spent - coverage.amountCents } : current;
      const patch = calculatePipeRulePatch(covered, {
        now,
        capUpdateValue: current.capUpdateValue == null ? undefined : current.capUpdateValue * countDueOccurrences(current, now),
      });
      const after = { ...current, ...patch };
      workingById.set(current._id, after);
      settlements.push({ before: current, after, ...(coverage ? { coverage } : {}) });
      affectedRoots.add(rootByPipeId.get(current._id)!);
    }
  }

  for (const rootId of affectedRoots) {
    const tree = pipesByRoot.get(rootId) ?? [];
    const recalculated = recalculatePipes(
      tree.map((pipe) => workingById.get(pipe._id)!),
    );
    for (const update of recalculated) {
      const current = workingById.get(update._id);
      if (current) workingById.set(update._id, { ...current, fed: update.fed });
    }
  }

  const patches = new Map<Id<"pipes">, CronAccountingPatch>();
  for (const rootId of affectedRoots) {
    for (const pipe of pipesByRoot.get(rootId) ?? []) {
      const before = originalById.get(pipe._id)!;
      const after = workingById.get(pipe._id)!;
      const patch = buildAccountingPatch(before, after);
      if (Object.keys(patch).length > 0) patches.set(pipe._id, patch);
    }
  }
  return { patches, settlements };
}

async function loadCronCandidates(
  ctx: MutationCtx,
  args: RunDueCronRulesArgs,
  now: number,
): Promise<{ candidates: Doc<"pipes">[]; cursor?: string }> {
  if (args.pendingPipeIds !== undefined) {
    const candidates = await Promise.all(
      [...new Set(args.pendingPipeIds)].map((pipeId) =>
        ctx.db.get("pipes", pipeId),
      ),
    );
    return {
      candidates: candidates.filter(
        (pipe): pipe is Doc<"pipes"> => pipe !== null,
      ),
      cursor: args.cursor,
    };
  }

  const today = new Date(now);
  const startOfToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000;
  const page = await ctx.db
    .query("pipes")
    .withIndex("by_rule_cronNextDate", (q) =>
      q.eq("rule", "cron").lt("cronNextDate", endOfToday),
    )
    .paginate({
      numItems: CRON_CANDIDATE_PAGE_SIZE,
      cursor: args.cursor ?? null,
    });

  return {
    candidates: page.page,
    cursor: page.isDone ? undefined : page.continueCursor,
  };
}

export async function runDueCronRulesOperation(
  ctx: MutationCtx,
  args: RunDueCronRulesArgs,
  scheduleContinuation: ScheduleCronContinuation,
  onComplete?: (ctx: MutationCtx, now: number) => Promise<unknown>,
): Promise<null> {
  const now = args.now ?? Date.now();
  const { candidates, cursor } = await loadCronCandidates(ctx, args, now);
  const grouped = groupCandidatesByUser(
    candidates.filter((candidate) => countDueOccurrences(candidate, now) > 0),
  );
  const deferredPipeIds: Id<"pipes">[] = [];
  const patches = new Map<Id<"pipes">, CronAccountingPatch>();
  let snapshotPipeCount = 0;

  for (const [userId, userCandidates] of grouped) {
    if (
      snapshotPipeCount > 0 &&
      snapshotPipeCount + MAX_PIPES_PER_USER >
        MAX_CRON_SNAPSHOT_PIPE_COUNT
    ) {
      deferredPipeIds.push(...userCandidates.map((pipe) => pipe._id));
      continue;
    }

    const userPipes = await ctx.db
      .query("pipes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(MAX_PIPES_PER_USER + 1);
    if (userPipes.length > MAX_PIPES_PER_USER) throw new ConvexError({ code: "PIPE_LIMIT_REACHED" });
    snapshotPipeCount += userPipes.length;

    const plan = calculateUserCronPlan(userPipes, now);
    for (const [pipeId, patch] of plan.patches) {
      patches.set(pipeId, patch);
    }
    for (const settlement of plan.settlements) {
      await recordSettlementHistory(ctx, settlement.before, settlement.after, "cron", now, settlement.coverage);
    }
  }

  await Promise.all(
    [...patches].map(([pipeId, patch]) =>
      ctx.db.patch("pipes", pipeId, patch),
    ),
  );

  if (deferredPipeIds.length > 0 || cursor !== undefined) {
    await scheduleContinuation(ctx, {
      now,
      ...(cursor !== undefined ? { cursor } : {}),
      ...(deferredPipeIds.length > 0 ? { pendingPipeIds: deferredPipeIds } : {}),
    });
  } else {
    await onComplete?.(ctx, now);
  }

  return null;
}
