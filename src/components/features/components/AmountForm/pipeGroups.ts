import type { InputProps } from "@ui/Input";

type SelectGroup = NonNullable<Extract<InputProps, { type: "select" }>["groups"]>[number];

type Pipe = { id: string; name: string; icon: string; parentId?: string };

/** Candidate order is already ranked by the caller; only root membership is added here. */
export function groupPipesByRoot(
  candidates: readonly Pipe[],
  catalog: readonly Pipe[],
  options: { preferredPipeId?: string; expandFirst?: boolean } = {},
): SelectGroup[] {
  const byId = new Map(catalog.map(pipe => [pipe.id, pipe]));
  if (!candidates.some(pipe => byId.get(pipe.id)?.parentId)) return [];

  function rootOf(id: string): Pipe | undefined {
    const seen = new Set<string>();
    let pipe = byId.get(id);
    while (pipe?.parentId) {
      if (seen.has(pipe.id)) return undefined;
      seen.add(pipe.id);
      pipe = byId.get(pipe.parentId);
    }
    return pipe;
  }

  const groups = new Map<string, SelectGroup>();
  for (const candidate of candidates) {
    const root = rootOf(candidate.id);
    if (!root) continue;
    const group = groups.get(root.id);
    if (group) {
      groups.set(root.id, { ...group, itemIds: [...group.itemIds, candidate.id] });
    } else {
      groups.set(root.id, { id: root.id, name: root.name, icon: root.icon, itemIds: [candidate.id] });
    }
  }

  const preferredRootId = options.preferredPipeId ? rootOf(options.preferredPipeId)?.id : undefined;
  const ordered = [...groups.values()];
  if (preferredRootId && groups.has(preferredRootId)) {
    const index = ordered.findIndex(group => group.id === preferredRootId);
    ordered.unshift(ordered.splice(index, 1)[0]);
  }
  const expandedId = preferredRootId && groups.has(preferredRootId)
    ? preferredRootId : options.expandFirst ? ordered[0]?.id : undefined;
  return ordered.map(group => ({ ...group, initiallyExpanded: group.id === expandedId }));
}
