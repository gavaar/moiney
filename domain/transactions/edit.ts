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
): TransactionEditPlan<PipeId> {
  const deltas = new Map<PipeId, TransactionEditDelta<PipeId>>();
  const affectedPipeIds = new Set<PipeId>();

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
  for (const delta of [...previousDeltas, ...currentDeltas]) {
    affectedPipeIds.add(delta.pipeId);
  }
  for (const delta of previousDeltas) {
    add(delta, -1);
  }
  for (const delta of currentDeltas) {
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
