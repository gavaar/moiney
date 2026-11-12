import type { TreeNode } from "@ui/TreeList";

type Pipe = { id: string; name: string; parentId?: string };

/** Connects ranked eligible IDs through real ancestors, without expanding eligibility. */
export function buildPipeTree<Item extends Pipe>(
  catalog: readonly Item[],
  selectableIds: readonly string[] = catalog.map(pipe => pipe.id),
  { rootId, preferredPipeId }: { rootId?: string; preferredPipeId?: string } = {},
): { items: Item[]; tree: TreeNode[] } {
  const byId = new Map(catalog.map(pipe => [pipe.id, pipe]));
  const selectable = new Set(selectableIds);
  const included = new Map<string, Item>();

  function ancestry(id: string): Item[] {
    const path: Item[] = [];
    const seen = new Set<string>();
    let pipe = byId.get(id);
    while (pipe) {
      if (seen.has(pipe.id)) return [];
      seen.add(pipe.id);
      path.unshift(pipe);
      if (pipe.id === rootId || (!rootId && !pipe.parentId)) return path;
      pipe = pipe.parentId ? byId.get(pipe.parentId) : undefined;
    }
    return [];
  }

  for (const id of selectableIds) {
    for (const pipe of ancestry(id)) included.set(pipe.id, pipe);
  }
  const preferredRoot = preferredPipeId ? ancestry(preferredPipeId)[0] : undefined;
  const items = [...included.values()];
  if (preferredRoot && included.has(preferredRoot.id)) {
    items.splice(items.findIndex(pipe => pipe.id === preferredRoot.id), 1);
    items.unshift(preferredRoot);
  }
  return {
    items,
    tree: items.map(pipe => ({
      id: pipe.id,
      label: pipe.name,
      parentId: pipe.id === rootId ? undefined : pipe.parentId,
      selectable: selectable.has(pipe.id),
    })),
  };
}
