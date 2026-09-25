import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  canonicalizeTransactionTitle,
  deriveTransactionKind,
  planTransactionDeletion,
  planTransactionEdit,
  transactionAccountingEffects,
  transactionStructureFromRoles,
  type TransactionEditPlan,
  type TransactionStructure,
} from "../../../domain/transactions";
import {
  assertAmountLimit,
  validateTransactionAmount,
} from "../../../domain/money";
import { shouldTriggerPipeRule } from "../../../domain/pipes";
import {
  collectChildSubtree,
  executePipeRule,
  reconcileAffectedPipeRoots,
  resolveTopMostAncestor,
} from "../pipes";
import { updateOrCreateTitleUsage } from "../transactions";

export type CreateTransactionCommand = {
  title: string;
  value: number;
  date: number;
  from?: Id<"pipes">;
  to?: Id<"pipes">;
  paidFrom?: Id<"pipes">;
  requireBoiler?: boolean;
  currentFedOverride?: number;
};

export type EditTransactionCommand = {
  transactionId: Id<"transactions">;
  title: string;
  value: number;
  date: number;
  primaryPipeId?: Id<"pipes">;
  applyReplacementEffects?: boolean;
  target?:
    | { type: "expense" }
    | { type: "transfer"; to: Id<"pipes"> }
    | { type: "payByTransfer"; paidFrom: Id<"pipes"> };
};

export type DeleteTransactionCommand = {
  transactionId: Id<"transactions">;
};

export type TransactionWriteResult = {
  id: Id<"transactions">;
  createdAt: number;
  title: string;
  value: number;
  date: number;
  kind: "feed" | "expense" | "transfer";
  from?: Id<"pipes">;
  to?: Id<"pipes">;
  paidFrom?: Id<"pipes">;
  fromIcon?: string;
  toIcon?: string;
  paidFromIcon?: string;
  editedAt?: number;
};

function buildTransactionWriteResult(
  id: Id<"transactions">,
  createdAt: number,
  transaction: Omit<TransactionWriteResult, "id" | "createdAt">,
): TransactionWriteResult {
  const result: TransactionWriteResult = {
    id,
    createdAt,
    title: transaction.title,
    value: transaction.value,
    date: transaction.date,
    kind: transaction.kind,
  };

  if (transaction.from !== undefined) result.from = transaction.from;
  if (transaction.to !== undefined) result.to = transaction.to;
  if (transaction.paidFrom !== undefined) result.paidFrom = transaction.paidFrom;
  if (transaction.fromIcon !== undefined) result.fromIcon = transaction.fromIcon;
  if (transaction.toIcon !== undefined) result.toIcon = transaction.toIcon;
  if (transaction.paidFromIcon !== undefined) {
    result.paidFromIcon = transaction.paidFromIcon;
  }
  if (transaction.editedAt !== undefined) result.editedAt = transaction.editedAt;

  return result;
}

function createCachedPipeReader(ctx: MutationCtx) {
  const cache = new Map<Id<"pipes">, Promise<Doc<"pipes"> | null>>();
  return async (pipeId: Id<"pipes">) => {
    let pipe = cache.get(pipeId);
    if (!pipe) {
      pipe = ctx.db.get("pipes", pipeId);
      cache.set(pipeId, pipe);
    }
    return await pipe;
  };
}

async function applyTransactionAccountingPlan(
  ctx: MutationCtx,
  plan: TransactionEditPlan<Id<"pipes">>,
  getPipe: ReturnType<typeof createCachedPipeReader>,
) {
  for (const delta of plan.deltas) {
    const pipe = await getPipe(delta.pipeId);
    if (!pipe) throw new Error("Pipe not found");
    const patch: {
      fed?: number;
      spent?: number;
      pendingFedAdjustment?: number;
      contributedFed?: number;
    } = {};
    if (delta.fedDelta !== 0) patch.fed = pipe.fed + delta.fedDelta;
    if (delta.spentDelta !== 0) patch.spent = pipe.spent + delta.spentDelta;
    if (delta.pendingFedAdjustmentDelta !== 0) {
      patch.pendingFedAdjustment =
        (pipe.pendingFedAdjustment ?? 0) + delta.pendingFedAdjustmentDelta;
    }
    if (delta.contributedFedDelta !== 0 && pipe.sourceType === "boiler") {
      patch.contributedFed =
        (pipe.contributedFed ?? 0) + delta.contributedFedDelta;
    }
    await ctx.db.patch("pipes", delta.pipeId, patch);
    const newSpent = patch.spent ?? pipe.spent;
    if (
      shouldTriggerPipeRule(
        pipe.rule,
        delta.spentDelta,
        newSpent,
        pipe.capacity,
      )
    ) {
      await executePipeRule(ctx, delta.pipeId);
    }
  }
  await reconcileAffectedPipeRoots(ctx, plan.affectedPipeIds, getPipe);
}

async function assertPipeTreesNotFrozen(
  ctx: MutationCtx,
  pipes: Doc<"pipes">[],
  getPipe: ReturnType<typeof createCachedPipeReader>,
) {
  const rootIds = new Set<Id<"pipes">>();
  for (const pipe of pipes) {
    rootIds.add(await resolveTopMostAncestor(ctx, pipe._id, undefined, getPipe));
  }
  for (const rootId of rootIds) {
    const root = await ctx.db.get("pipes", rootId);
    if (!root) continue;
    const tree = [root, ...(await collectChildSubtree(ctx, rootId))];
    if (tree.some((pipe) => pipe.deletionJobId)) {
      throw new Error("Pipe is being deleted");
    }
  }
}

async function localFedForAggregate(
  ctx: MutationCtx,
  pipeId: Id<"pipes">,
  aggregateFed: number,
): Promise<number> {
  const descendants = await collectChildSubtree(ctx, pipeId);
  return assertAmountLimit(
    assertAmountLimit(aggregateFed) -
      descendants.reduce((total, pipe) => total + pipe.fed, 0),
  );
}

export async function correctBoilerCurrentFedOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  pipeId: Id<"pipes">,
  currentFed: number,
): Promise<void> {
  const pipe = await ctx.db.get("pipes", pipeId);
  if (
    !pipe ||
    pipe.userId !== userId ||
    pipe.parentId !== undefined ||
    pipe.sourceType !== "boiler"
  ) {
    throw new ConvexError({ code: "BOILER_NOT_FOUND" });
  }
  if (pipe.deletionJobId) throw new Error("Pipe is being deleted");

  await ctx.db.patch("pipes", pipeId, {
    fed: await localFedForAggregate(ctx, pipeId, currentFed),
  });
  await reconcileAffectedPipeRoots(ctx, [pipeId]);
}

export async function createTransactionOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  command: CreateTransactionCommand,
  now: number,
): Promise<TransactionWriteResult> {
  const title = canonicalizeTransactionTitle(command.title);
  const value = command.value;
  const getPipe = createCachedPipeReader(ctx);

  if (command.paidFrom && (!command.from || command.to)) {
    throw new Error("Pay by transfer requires from and paidFrom only");
  }
  if (!command.from && !command.to) {
    throw new Error("Either 'from' or 'to' must be provided");
  }

  const kind = deriveTransactionKind(command);
  validateTransactionAmount(value, kind === "feed" ? "feed" : "transaction");
  for (const pipeId of new Set([
    command.from,
    command.to,
    command.paidFrom,
  ])) {
    if (!pipeId) continue;
    const pipe = await getPipe(pipeId);
    if (pipe?.deletionJobId) throw new Error("Pipe is being deleted");
  }

  if (!command.from && command.to) {
    const destPipe = await getPipe(command.to);
    if (!destPipe) throw new Error("Pipe not found");
    if (destPipe.userId !== userId) throw new Error("Not authorized");
    if (command.requireBoiler && destPipe.sourceType !== "boiler") {
      throw new ConvexError({ code: "BOILER_NOT_FOUND" });
    }

    const { to } = transactionAccountingEffects({ to: command.to }, value);
    const fed =
      command.currentFedOverride === undefined
        ? destPipe.fed + to.fedDelta
        : await localFedForAggregate(
            ctx,
            command.to,
            command.currentFedOverride,
          );
    await ctx.db.patch("pipes", command.to, {
      fed,
      ...(destPipe.sourceType === "boiler"
        ? { contributedFed: (destPipe.contributedFed ?? 0) + value }
        : {}),
    });
    if (
      shouldTriggerPipeRule(
        destPipe.rule,
        to.spentDelta,
        destPipe.spent + to.spentDelta,
        destPipe.capacity,
      )
    ) {
      await executePipeRule(ctx, command.to);
    }

    const transactionId = await ctx.db.insert("transactions", {
      title,
      value,
      date: command.date,
      kind,
      from: undefined,
      to: command.to,
      userId,
    });
    await updateOrCreateTitleUsage(ctx, {
      pipeId: command.to,
      userId,
      title,
      now,
    });
    await reconcileAffectedPipeRoots(ctx, [command.to], getPipe);
    return buildTransactionWriteResult(transactionId, now, {
      title,
      value,
      date: command.date,
      kind,
      to: command.to,
    });
  }

  const pipeId = command.from!;
  if (command.paidFrom && pipeId === command.paidFrom) {
    throw new Error("Paid from pipe must be different");
  }
  const pipe = await getPipe(pipeId);
  if (!pipe || pipe.userId !== userId) {
    throw new ConvexError({ code: "TRANSACTION_PIPE_NOT_FOUND" });
  }

  if (command.paidFrom) {
    const paidFromPipe = await getPipe(command.paidFrom);
    if (!paidFromPipe) throw new Error("Paid from pipe not found");
    if (paidFromPipe.userId !== userId) throw new Error("Not authorized");

    const [fromRootId, paidFromRootId] = await Promise.all([
      resolveTopMostAncestor(ctx, pipeId, undefined, getPipe),
      resolveTopMostAncestor(ctx, command.paidFrom, undefined, getPipe),
    ]);
    if (fromRootId === paidFromRootId) {
      throw new Error("Paid from pipe must be outside the transaction tree");
    }

    const fromChildren = await ctx.db
      .query("pipes")
      .withIndex("by_parentId", (q) => q.eq("parentId", pipeId))
      .take(1);
    if (fromChildren.length > 0) {
      throw new Error("Transaction pipe must not have children");
    }

    if (value > 0) {
      if (paidFromPipe.parentId) {
        throw new Error(
          "Refund destination must be a root outside the transaction tree",
        );
      }
    } else {
      const paidFromChildren = await ctx.db
        .query("pipes")
        .withIndex("by_parentId", (q) => q.eq("parentId", command.paidFrom!))
        .take(1);
      if (paidFromChildren.length > 0) {
        throw new Error("Paid from pipe must not have children");
      }
    }

    const { from, paidFrom } = transactionAccountingEffects(
      { from: pipeId, paidFrom: command.paidFrom },
      value,
    );
    const newSpent = pipe.spent + from.spentDelta;
    await ctx.db.patch("pipes", pipeId, {
      spent: newSpent,
      pendingFedAdjustment:
        (pipe.pendingFedAdjustment ?? 0) + from.fedDelta,
    });
    await ctx.db.patch("pipes", command.paidFrom, {
      fed: paidFromPipe.fed + paidFrom.fedDelta,
    });
    if (
      shouldTriggerPipeRule(
        pipe.rule,
        from.spentDelta,
        newSpent,
        pipe.capacity,
      )
    ) {
      await executePipeRule(ctx, pipeId);
    }
    await reconcileAffectedPipeRoots(
      ctx,
      [pipeId, command.paidFrom],
      getPipe,
    );

    const transactionId = await ctx.db.insert("transactions", {
      title,
      value,
      date: command.date,
      kind,
      from: pipeId,
      paidFrom: command.paidFrom,
      userId,
    });
    await updateOrCreateTitleUsage(ctx, {
      pipeId,
      userId,
      title,
      now,
    });
    return buildTransactionWriteResult(transactionId, now, {
      title,
      value,
      date: command.date,
      kind,
      from: pipeId,
      paidFrom: command.paidFrom,
    });
  }

  if (command.to) {
    if (pipeId === command.to) throw new Error("Cannot transfer to self");

    const destPipe = await getPipe(command.to);
    if (!destPipe || destPipe.userId !== userId) {
      throw new ConvexError({ code: "TRANSACTION_PIPE_NOT_FOUND" });
    }
    if (destPipe.parentId) {
      throw new ConvexError({ code: "TRANSFER_DESTINATION_NOT_ROOT" });
    }
    const sourceRootId = await resolveTopMostAncestor(
      ctx,
      pipeId,
      undefined,
      getPipe,
    );
    if (sourceRootId === command.to) {
      throw new ConvexError({ code: "TRANSFER_SAME_TREE" });
    }
    const sourceChildren = await ctx.db
      .query("pipes")
      .withIndex("by_parentId", (q) => q.eq("parentId", pipeId))
      .take(1);
    if (sourceChildren.length > 0) {
      throw new ConvexError({ code: "TRANSFER_SOURCE_NOT_LEAF" });
    }

    const { from, to } = transactionAccountingEffects(
      { from: pipeId, to: command.to },
      value,
    );
    await ctx.db.patch("pipes", pipeId, {
      fed: pipe.fed + from.fedDelta,
    });
    await ctx.db.patch("pipes", command.to, {
      fed: destPipe.fed + to.fedDelta,
      ...(destPipe.sourceType === "boiler"
        ? {
            contributedFed:
              (destPipe.contributedFed ?? 0) + to.fedDelta,
          }
        : {}),
    });
    if (
      shouldTriggerPipeRule(
        pipe.rule,
        from.spentDelta,
        pipe.spent,
        pipe.capacity,
      )
    ) {
      await executePipeRule(ctx, pipeId);
    }
    await reconcileAffectedPipeRoots(ctx, [pipeId, command.to], getPipe);
  } else {
    const sourceChildren = await ctx.db
      .query("pipes")
      .withIndex("by_parentId", (q) => q.eq("parentId", pipeId))
      .take(1);
    if (sourceChildren.length > 0) {
      throw new ConvexError({ code: "SOURCE_HAS_CHILDREN" });
    }

    const { from } = transactionAccountingEffects({ from: pipeId }, value);
    const newSpent = pipe.spent + from.spentDelta;
    await ctx.db.patch("pipes", pipeId, { spent: newSpent });
    if (
      shouldTriggerPipeRule(
        pipe.rule,
        from.spentDelta,
        newSpent,
        pipe.capacity,
      )
    ) {
      await executePipeRule(ctx, pipeId);
    }
    await reconcileAffectedPipeRoots(ctx, [pipeId], getPipe);
  }

  const transactionId = await ctx.db.insert("transactions", {
    title,
    value,
    date: command.date,
    kind,
    from: pipeId,
    to: command.to,
    userId,
  });
  await updateOrCreateTitleUsage(ctx, {
    pipeId,
    userId,
    title,
    now,
  });
  return buildTransactionWriteResult(transactionId, now, {
    title,
    value,
    date: command.date,
    kind,
    from: pipeId,
    to: command.to,
  });
}

export async function editTransactionOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  command: EditTransactionCommand,
  now: number,
): Promise<TransactionWriteResult> {
  const transaction = await ctx.db.get("transactions", command.transactionId);
  if (!transaction) throw new Error("Transaction not found");
  if (transaction.userId !== userId) throw new Error("Not authorized");
  const getPipe = createCachedPipeReader(ctx);

  const title = canonicalizeTransactionTitle(command.title);
  const previousStructure = transactionStructureFromRoles(transaction);
  let currentStructure: TransactionStructure<Id<"pipes">> = previousStructure;
  if (command.target) {
    if (previousStructure.type === "feed") {
      throw new Error("Feed transaction structure cannot be changed");
    }
    if (previousStructure.type === "payByTransfer" && command.target.type !== "payByTransfer") {
      throw new Error("Pay-by-transfer structure cannot be changed");
    }
    currentStructure =
      command.target.type === "expense"
        ? { type: "expense", from: command.primaryPipeId ?? previousStructure.from }
        : command.target.type === "transfer"
          ? {
              type: "transfer",
              from: command.primaryPipeId ?? previousStructure.from,
              to: command.target.to,
            }
          : {
              type: "payByTransfer",
              from: command.primaryPipeId ?? previousStructure.from,
              paidFrom: command.target.paidFrom,
            };
  } else if (command.primaryPipeId) {
    currentStructure = previousStructure.type === "feed"
      ? { type: "feed", to: command.primaryPipeId }
      : { ...previousStructure, from: command.primaryPipeId };
  }
  const currentKind =
    currentStructure.type === "feed"
      ? "feed"
      : currentStructure.type === "transfer"
        ? "transfer"
        : "expense";
  const currentFrom =
    currentStructure.type === "feed" ? undefined : currentStructure.from;
  const currentTo =
    currentStructure.type === "feed" || currentStructure.type === "transfer"
      ? currentStructure.to
      : undefined;
  const currentPaidFrom =
    currentStructure.type === "payByTransfer"
      ? currentStructure.paidFrom
      : undefined;
  const structureChanged =
    currentKind !== transaction.kind ||
    currentFrom !== transaction.from ||
    currentTo !== transaction.to ||
    currentPaidFrom !== transaction.paidFrom;

  const oldRoles = {
    from: transaction.from,
    to: transaction.to,
    paidFrom: transaction.paidFrom,
  };
  const newRoles = { from: currentFrom, to: currentTo, paidFrom: currentPaidFrom };
  const invalidPreviousPipeIds: Id<"pipes">[] = [];
  const ownedOldPipes: Doc<"pipes">[] = [];
  for (const role of ["from", "to", "paidFrom"] as const) {
    const oldId = oldRoles[role];
    if (!oldId) continue;
    const pipe = await getPipe(oldId);
    if (pipe && pipe.userId !== userId) throw new ConvexError({ code: "TRANSACTION_PIPE_NOT_FOUND" });
    if (pipe) ownedOldPipes.push(pipe);
    if (pipe?.deletionJobId) throw new Error("Pipe is being deleted");
    const hasChildren = pipe && (role === "from" || (role === "paidFrom" && transaction.value < 0))
      ? (await ctx.db.query("pipes").withIndex("by_parentId", q => q.eq("parentId", oldId)).take(1)).length > 0
      : false;
    const invalid = !pipe || transaction[`${role}Icon`] !== undefined || hasChildren ||
      (role === "to" && !!pipe.parentId) ||
      (role === "paidFrom" && transaction.value > 0 && !!pipe.parentId);
    if (invalid) {
      invalidPreviousPipeIds.push(oldId);
      if (!newRoles[role] || newRoles[role] === oldId) {
        throw new ConvexError({ code: "TRANSACTION_PIPE_REPLACEMENT_REQUIRED" });
      }
    }
  }
  if (invalidPreviousPipeIds.length > 0 && command.applyReplacementEffects === undefined) {
    throw new ConvexError({ code: "TRANSACTION_REPLACEMENT_CHOICE_REQUIRED" });
  }
  if (invalidPreviousPipeIds.length === 0 && command.applyReplacementEffects !== undefined) {
    throw new ConvexError({ code: "TRANSACTION_REPLACEMENT_CHOICE_UNAVAILABLE" });
  }
  const newPipes: Doc<"pipes">[] = [];
  for (const pipeId of new Set([
    currentFrom,
    currentTo,
    currentPaidFrom,
  ])) {
    if (!pipeId) continue;
    const pipe = await getPipe(pipeId);
    if (!pipe || pipe.userId !== userId) {
      throw new ConvexError({ code: "TRANSACTION_PIPE_NOT_FOUND" });
    }
    if (pipe.deletionJobId) throw new Error("Pipe is being deleted");
    newPipes.push(pipe);
  }
  await assertPipeTreesNotFrozen(ctx, [...ownedOldPipes, ...newPipes], getPipe);

  const valueDiff = command.value - transaction.value;
  validateTransactionAmount(
    command.value,
    currentKind === "feed" ? "feed" : "transaction",
  );

  const accountingChanged = structureChanged || valueDiff !== 0;
  if (currentStructure.type === "expense" || currentStructure.type === "payByTransfer" || currentStructure.type === "feed") {
    const sourceId = currentStructure.type === "feed" ? currentStructure.to : currentStructure.from;
    const source = await getPipe(sourceId);
    if (currentStructure.type === "feed") {
      if (source?.parentId) throw new ConvexError({ code: "FEED_DESTINATION_NOT_ROOT" });
    } else {
      const children = await ctx.db.query("pipes").withIndex("by_parentId", q => q.eq("parentId", sourceId)).take(1);
      if (children.length > 0) throw new ConvexError({ code: "SOURCE_HAS_CHILDREN" });
    }
  }
  if (accountingChanged && currentStructure.type === "transfer") {
    const destination = await getPipe(currentStructure.to);
    if (!destination) throw new Error("Pipe not found");
    if (destination.parentId) {
      throw new ConvexError({ code: "TRANSFER_DESTINATION_NOT_ROOT" });
    }
    const sourceRoot = await resolveTopMostAncestor(
      ctx,
      currentStructure.from,
      undefined,
      getPipe,
    );
    if (sourceRoot === currentStructure.to) {
      throw new ConvexError({ code: "TRANSFER_SAME_TREE" });
    }
    const sourceChildren = await ctx.db
      .query("pipes")
      .withIndex("by_parentId", (q) => q.eq("parentId", currentStructure.from))
      .take(1);
    if (sourceChildren.length > 0) {
      throw new ConvexError({ code: "TRANSFER_SOURCE_NOT_LEAF" });
    }
  } else if (accountingChanged && currentStructure.type === "payByTransfer") {
    const paidFromPipe = await getPipe(currentStructure.paidFrom);
    if (!paidFromPipe) throw new Error("Pipe not found");
    if (accountingChanged) {
      const [sourceRoot, paidFromRoot] = await Promise.all([
        resolveTopMostAncestor(ctx, currentStructure.from, undefined, getPipe),
        resolveTopMostAncestor(
          ctx,
          currentStructure.paidFrom,
          undefined,
          getPipe,
        ),
      ]);
      if (sourceRoot === paidFromRoot) {
        throw new Error("Paid from pipe must be outside the transaction tree");
      }
      const sourceChildren = await ctx.db
        .query("pipes")
        .withIndex("by_parentId", (q) => q.eq("parentId", currentStructure.from))
        .take(1);
      if (sourceChildren.length > 0) {
        throw new Error("Transaction pipe must not have children");
      }
    }
    if (command.value > 0) {
      if (paidFromPipe.parentId) {
        throw new Error(
          "Refund destination must be a root outside the transaction tree",
        );
      }
    } else {
      const paidFromChildren = await ctx.db
        .query("pipes")
        .withIndex("by_parentId", (q) =>
          q.eq("parentId", currentStructure.paidFrom),
        )
        .take(1);
      if (paidFromChildren.length > 0) {
        throw new Error("Paid from pipe must not have children");
      }
    }
  }

  if (accountingChanged) {
    const editPlan = planTransactionEdit(
      previousStructure,
      transaction.value,
      currentStructure,
      command.value,
      { invalidPreviousPipeIds, applyReplacementEffects: command.applyReplacementEffects },
    );
    if (editPlan.affectedPipeIds.length > 0) await applyTransactionAccountingPlan(ctx, editPlan, getPipe);
  }

  const hasCorrection =
    title !== transaction.title ||
    command.value !== transaction.value ||
    command.date !== transaction.date ||
    structureChanged;
  const editedAt = hasCorrection ? now : undefined;

  if (editedAt !== undefined) {
    await ctx.db.insert("transactionCorrections", {
      transactionId: command.transactionId,
      userId,
      editedAt,
      previous: {
        title: transaction.title,
        value: transaction.value,
        date: transaction.date,
        kind: transaction.kind,
        ...(transaction.from !== undefined ? { from: transaction.from } : {}),
        ...(transaction.to !== undefined ? { to: transaction.to } : {}),
        ...(transaction.paidFrom !== undefined
          ? { paidFrom: transaction.paidFrom }
          : {}),
      },
      current: {
        title,
        value: command.value,
        date: command.date,
        kind: currentKind,
        ...(currentFrom !== undefined ? { from: currentFrom } : {}),
        ...(currentTo !== undefined ? { to: currentTo } : {}),
        ...(currentPaidFrom !== undefined ? { paidFrom: currentPaidFrom } : {}),
      },
    });
  }

  await ctx.db.patch("transactions", command.transactionId, {
    title,
    value: command.value,
    date: command.date,
    kind: currentKind,
    from: currentFrom,
    to: currentTo,
    paidFrom: currentPaidFrom,
    fromIcon: undefined,
    toIcon: undefined,
    paidFromIcon: undefined,
    ...(editedAt !== undefined ? { editedAt } : {}),
  });
  return buildTransactionWriteResult(command.transactionId, transaction._creationTime, {
    title,
    value: command.value,
    date: command.date,
    kind: currentKind,
    from: currentFrom,
    to: currentTo,
    paidFrom: currentPaidFrom,
    editedAt: editedAt ?? transaction.editedAt,
  });
}

export async function deleteTransactionOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  command: DeleteTransactionCommand,
): Promise<void> {
  const transaction = await ctx.db.get("transactions", command.transactionId);
  if (!transaction || transaction.userId !== userId) {
    throw new ConvexError({ code: "TRANSACTION_NOT_FOUND" });
  }

  const getPipe = createCachedPipeReader(ctx);
  const pipeIds = [...new Set([
    transaction.from,
    transaction.to,
    transaction.paidFrom,
  ].filter((pipeId): pipeId is Id<"pipes"> => pipeId !== undefined))];
  const pipes = await Promise.all(pipeIds.map((pipeId) => getPipe(pipeId)));
  const structure = transactionStructureFromRoles(transaction);
  const allRolesAvailable = pipes.every(
    (pipe) => pipe !== null && pipe.userId === userId,
  );
  const canRollback = allRolesAvailable;

  if (canRollback) {
    for (const pipe of pipes) {
      if (pipe?.deletionJobId) throw new Error("Pipe is being deleted");
    }
    await applyTransactionAccountingPlan(
      ctx,
      planTransactionDeletion(structure, transaction.value),
      getPipe,
    );
  } else {
    const survivingOwnedPipes = pipes.filter(
      (pipe): pipe is Doc<"pipes"> => pipe !== null && pipe.userId === userId,
    );
    await assertPipeTreesNotFrozen(ctx, survivingOwnedPipes, getPipe);
  }

  await ctx.db.delete("transactions", command.transactionId);
}
