import type { TransactionStructure } from "./structure";
import { transactionAccountingEffects } from "./accounting";

export type TransactionEditDelta<PipeId> = {
  pipeId: PipeId;
  fedDelta: number;
  spentDelta: number;
  pendingFedAdjustmentDelta: number;
  contributedFedDelta: number;
};

export type TransactionEditPlan<PipeId> = {
  deltas: TransactionEditDelta<PipeId>[];
  affectedPipeIds: PipeId[];
};

function accountingDeltas<PipeId extends string>(
  structure: TransactionStructure<PipeId>,
  value: number,
): TransactionEditDelta<PipeId>[] {
  const unchanged = {
    spentDelta: 0,
    pendingFedAdjustmentDelta: 0,
    contributedFedDelta: 0,
  };

  switch (structure.type) {
    case "feed": {
      const { to } = transactionAccountingEffects({ to: structure.to }, value);
      return [{
        pipeId: to.pipeId,
        fedDelta: to.fedDelta,
        ...unchanged,
        contributedFedDelta: to.fedDelta,
      }];
    }
    case "expense": {
      const { from } = transactionAccountingEffects(
        { from: structure.from },
        value,
      );
      return [{
        pipeId: from.pipeId,
        fedDelta: from.fedDelta,
        spentDelta: from.spentDelta,
        pendingFedAdjustmentDelta: 0,
        contributedFedDelta: 0,
      }];
    }
    case "transfer": {
      const { from, to } = transactionAccountingEffects(
        { from: structure.from, to: structure.to },
        value,
      );
      return [
        { pipeId: from.pipeId, fedDelta: from.fedDelta, ...unchanged },
        {
          pipeId: to.pipeId,
          fedDelta: to.fedDelta,
          ...unchanged,
          contributedFedDelta: to.fedDelta,
        },
      ];
    }
    case "payByTransfer": {
      const { from, paidFrom } = transactionAccountingEffects(
        { from: structure.from, paidFrom: structure.paidFrom },
        value,
      );
      return [
        {
          pipeId: from.pipeId,
          fedDelta: 0,
          spentDelta: from.spentDelta,
          pendingFedAdjustmentDelta: from.fedDelta,
          contributedFedDelta: 0,
        },
        {
          pipeId: paidFrom.pipeId,
          fedDelta: paidFrom.fedDelta,
          ...unchanged,
        },
      ];
    }
  }
}

export function planTransactionEdit<PipeId extends string>(
  previousStructure: TransactionStructure<PipeId>,
  previousValue: number,
  currentStructure: TransactionStructure<PipeId>,
  currentValue: number,
  options: { invalidPreviousPipeIds?: readonly PipeId[]; applyReplacementEffects?: boolean } = {},
): TransactionEditPlan<PipeId> {
  const deltas = new Map<PipeId, TransactionEditDelta<PipeId>>();
  const affectedPipeIds = new Set<PipeId>();
  const invalidIds = new Set(options.invalidPreviousPipeIds ?? []);

  function add(delta: TransactionEditDelta<PipeId>, multiplier: 1 | -1) {
    const existing = deltas.get(delta.pipeId) ?? {
      pipeId: delta.pipeId,
      fedDelta: 0,
      spentDelta: 0,
      pendingFedAdjustmentDelta: 0,
      contributedFedDelta: 0,
    };
    deltas.set(delta.pipeId, {
      pipeId: delta.pipeId,
      fedDelta: existing.fedDelta + delta.fedDelta * multiplier,
      spentDelta: existing.spentDelta + delta.spentDelta * multiplier,
      pendingFedAdjustmentDelta:
        existing.pendingFedAdjustmentDelta +
        delta.pendingFedAdjustmentDelta * multiplier,
      contributedFedDelta:
        existing.contributedFedDelta + delta.contributedFedDelta * multiplier,
    });
  }

  const previousDeltas = accountingDeltas(previousStructure, previousValue);
  const currentDeltas = accountingDeltas(currentStructure, currentValue);
  const previousRoles = previousStructure as { from?: PipeId; to?: PipeId; paidFrom?: PipeId };
  const currentRoles = currentStructure as { from?: PipeId; to?: PipeId; paidFrom?: PipeId };
  const skippedReplacementIds = new Set<PipeId>();
  if (!options.applyReplacementEffects) {
    for (const role of ["from", "to", "paidFrom"] as const) {
      if (currentRoles[role] && (
        (previousRoles[role] !== undefined && invalidIds.has(previousRoles[role])) ||
        (invalidIds.size > 0 && previousRoles[role] === undefined)
      )) {
        skippedReplacementIds.add(currentRoles[role]);
      }
    }
  }
  for (const delta of [...previousDeltas, ...currentDeltas]) {
    if (invalidIds.has(delta.pipeId) || skippedReplacementIds.has(delta.pipeId)) continue;
    affectedPipeIds.add(delta.pipeId);
  }
  for (const delta of previousDeltas) {
    if (invalidIds.has(delta.pipeId)) continue;
    add(delta, -1);
  }
  for (const delta of currentDeltas) {
    if (skippedReplacementIds.has(delta.pipeId)) continue;
    add(delta, 1);
  }

  return {
    deltas: [...deltas.values()].filter(
      (delta) =>
        delta.fedDelta !== 0 ||
        delta.spentDelta !== 0 ||
        delta.pendingFedAdjustmentDelta !== 0 ||
        delta.contributedFedDelta !== 0,
    ),
    affectedPipeIds: [...affectedPipeIds],
  };
}

export function planTransactionDeletion<PipeId extends string>(
  structure: TransactionStructure<PipeId>,
  value: number,
): TransactionEditPlan<PipeId> {
  return planTransactionEdit(structure, value, structure, 0);
}
