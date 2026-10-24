import type { TransactionStructure } from "./structure";

type Pipe<PipeId> = { id: PipeId; parentId?: PipeId; blocked?: boolean };

/** Identify old roles whose effects cannot be reversed during a structural edit. */
export function invalidPreviousTransactionPipeIds<PipeId extends string>(
  structure: TransactionStructure<PipeId>,
  value: number,
  pipes: readonly Pipe<PipeId>[],
): PipeId[] {
  const byId = new Map(pipes.map(pipe => [pipe.id, pipe]));
  const parents = new Set(pipes.flatMap(pipe => pipe.parentId === undefined ? [] : [pipe.parentId]));
  const roles: { from?: PipeId; to?: PipeId; paidFrom?: PipeId } = structure;
  return (["from", "to", "paidFrom"] as const).flatMap(role => {
    const id = roles[role];
    if (!id) return [];
    const pipe = byId.get(id);
    const invalid = !pipe || pipe.blocked ||
      (role === "from" && parents.has(id)) ||
      (role === "to" && structure.type === "transfer" && !!pipe.parentId) ||
      (role === "paidFrom" && (value < 0 ? parents.has(id) : !!pipe.parentId));
    return invalid ? [id] : [];
  });
}
