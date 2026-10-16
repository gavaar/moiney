/** Include deleted descendants whose retained ancestry intersects the live scope. */
export function preservedPipeScope<Id extends string>(
  pipeIds: readonly Id[],
  deleted: readonly { pipeId: Id; ancestorIds: readonly Id[] }[],
): Set<Id> {
  const scope = new Set(pipeIds);
  return new Set([
    ...scope,
    ...deleted.filter(pipe => pipe.ancestorIds.some(id => scope.has(id))).map(pipe => pipe.pipeId),
  ]);
}
