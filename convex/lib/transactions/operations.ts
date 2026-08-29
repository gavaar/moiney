import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  canonicalizeTransactionTitle,
  deriveTransactionKind,
  transactionAccountingEffects,
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
  if (
    transaction.fromIcon !== undefined ||
    transaction.toIcon !== undefined ||
    transaction.paidFromIcon !== undefined
  ) {
    throw new Error("Transaction is view-only");
  }

  for (const pipeId of new Set([
    transaction.from,
    transaction.to,
    transaction.paidFrom,
  ])) {
    if (!pipeId) continue;
    const pipe = await getPipe(pipeId);
    if (!pipe || pipe.userId !== userId) {
      throw new ConvexError({ code: "TRANSACTION_PIPE_NOT_FOUND" });
    }
    if (pipe.deletionJobId) throw new Error("Pipe is being deleted");
  }

  const valueDiff = command.value - transaction.value;
  validateTransactionAmount(
    command.value,
    transaction.kind === "feed" ? "feed" : "transaction",
  );

  if (valueDiff !== 0) {
    if (transaction.from && transaction.paidFrom) {
      const fromPipe = await getPipe(transaction.from);
      const paidFromPipe = await getPipe(transaction.paidFrom);
      if (!fromPipe || !paidFromPipe) throw new Error("Pipe not found");

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
            q.eq("parentId", transaction.paidFrom!),
          )
          .take(1);
        if (paidFromChildren.length > 0) {
          throw new Error("Paid from pipe must not have children");
        }
      }

      const { from, paidFrom } = transactionAccountingEffects(
        { from: transaction.from, paidFrom: transaction.paidFrom },
        valueDiff,
      );
      const newSpent = fromPipe.spent + from.spentDelta;
      await ctx.db.patch("pipes", transaction.from, {
        spent: newSpent,
        pendingFedAdjustment:
          (fromPipe.pendingFedAdjustment ?? 0) + from.fedDelta,
      });
      await ctx.db.patch("pipes", transaction.paidFrom, {
        fed: paidFromPipe.fed + paidFrom.fedDelta,
      });
      if (
        shouldTriggerPipeRule(
          fromPipe.rule,
          from.spentDelta,
          newSpent,
          fromPipe.capacity,
        )
      ) {
        await executePipeRule(ctx, transaction.from);
      }
      await reconcileAffectedPipeRoots(
        ctx,
        [transaction.from, transaction.paidFrom],
        getPipe,
      );
    } else if (transaction.from && transaction.to) {
      const source = await getPipe(transaction.from);
      const destination = await getPipe(transaction.to);
      if (!source || !destination) throw new Error("Pipe not found");
      if (destination.parentId) {
        throw new ConvexError({ code: "TRANSFER_DESTINATION_NOT_ROOT" });
      }
      const sourceRoot = await resolveTopMostAncestor(
        ctx,
        transaction.from,
        undefined,
        getPipe,
      );
      if (sourceRoot === transaction.to) {
        throw new ConvexError({ code: "TRANSFER_SAME_TREE" });
      }
      const sourceChildren = await ctx.db
        .query("pipes")
        .withIndex("by_parentId", (q) => q.eq("parentId", transaction.from!))
        .take(1);
      if (sourceChildren.length > 0) {
        throw new ConvexError({ code: "TRANSFER_SOURCE_NOT_LEAF" });
      }

      const { from, to } = transactionAccountingEffects(
        { from: transaction.from, to: transaction.to },
        valueDiff,
      );
      await ctx.db.patch("pipes", transaction.from, {
        fed: source.fed + from.fedDelta,
      });
      await ctx.db.patch("pipes", transaction.to, {
        fed: destination.fed + to.fedDelta,
        ...(destination.sourceType === "boiler"
          ? {
              contributedFed:
                (destination.contributedFed ?? 0) + to.fedDelta,
            }
          : {}),
      });
      if (
        shouldTriggerPipeRule(
          source.rule,
          from.spentDelta,
          source.spent,
          source.capacity,
        )
      ) {
        await executePipeRule(ctx, transaction.from);
      }
      await reconcileAffectedPipeRoots(
        ctx,
        [transaction.from, transaction.to],
        getPipe,
      );
    } else if (transaction.from) {
      const pipe = await getPipe(transaction.from);
      if (!pipe) throw new Error("Pipe not found");

      const { from } = transactionAccountingEffects(
        { from: transaction.from },
        valueDiff,
      );
      const newSpent = pipe.spent + from.spentDelta;
      await ctx.db.patch("pipes", transaction.from, { spent: newSpent });
      if (
        shouldTriggerPipeRule(
          pipe.rule,
          from.spentDelta,
          newSpent,
          pipe.capacity,
        )
      ) {
        await executePipeRule(ctx, transaction.from);
      }
      await reconcileAffectedPipeRoots(ctx, [transaction.from], getPipe);
    } else if (transaction.to) {
      const pipe = await getPipe(transaction.to);
      if (!pipe) throw new Error("Pipe not found");

      const { to } = transactionAccountingEffects(
        { to: transaction.to },
        valueDiff,
      );
      await ctx.db.patch("pipes", transaction.to, {
        fed: pipe.fed + to.fedDelta,
        ...(pipe.sourceType === "boiler"
          ? { contributedFed: (pipe.contributedFed ?? 0) + valueDiff }
          : {}),
      });
      if (
        shouldTriggerPipeRule(
          pipe.rule,
          to.spentDelta,
          pipe.spent,
          pipe.capacity,
        )
      ) {
        await executePipeRule(ctx, transaction.to);
      }
      await reconcileAffectedPipeRoots(ctx, [transaction.to], getPipe);
    }
  }

  const hasCorrection =
    title !== transaction.title ||
    command.value !== transaction.value ||
    command.date !== transaction.date;
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
      },
      current: {
        title,
        value: command.value,
        date: command.date,
      },
    });
  }

  await ctx.db.patch("transactions", command.transactionId, {
    title,
    value: command.value,
    date: command.date,
    ...(editedAt !== undefined ? { editedAt } : {}),
  });
  return buildTransactionWriteResult(command.transactionId, transaction._creationTime, {
    title,
    value: command.value,
    date: command.date,
    kind: transaction.kind,
    from: transaction.from,
    to: transaction.to,
    paidFrom: transaction.paidFrom,
    fromIcon: transaction.fromIcon,
    toIcon: transaction.toIcon,
    paidFromIcon: transaction.paidFromIcon,
    editedAt: editedAt ?? transaction.editedAt,
  });
}
