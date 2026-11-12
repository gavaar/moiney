/** Presentation-only relationships; eligibility is decided by the caller. */
export type TreeNode = {
  id: string;
  label: string;
  parentId?: string;
  selectable: boolean;
};

export type TreeItemState = {
  root: boolean;
  muted: boolean;
  selected: boolean;
  multiple: boolean;
};

export function treeRows<Item extends { id: string }>(
  items: readonly Item[],
  tree: readonly TreeNode[],
  collapsed: ReadonlySet<string>,
  selected: ReadonlySet<string>,
) {
  const byId = new Map(items.map(item => [item.id, item]));
  const children = new Map<string | undefined, TreeNode[]>();
  for (const node of tree) {
    if (!byId.has(node.id)) continue;
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node);
    children.set(node.parentId, siblings);
  }
  type Row = { item: Item; node: TreeNode; branch: boolean[]; hasChildren: boolean; selectedInside: number };
  const rows: Row[] = [];
  function visit(nodes: readonly TreeNode[], branch: boolean[], root: boolean, hidden: boolean): number {
    let count = 0;
    nodes.forEach((node, index) => {
      const item = byId.get(node.id);
      if (!item) return;
      const path = root ? [] : [...branch, index < nodes.length - 1];
      const descendants = children.get(node.id) ?? [];
      const row = { item, node, branch: path, hasChildren: descendants.length > 0, selectedInside: 0 };
      if (!hidden) rows.push(row);
      row.selectedInside = visit(descendants, path, false, hidden || collapsed.has(node.id));
      count += row.selectedInside + (node.selectable && selected.has(node.id) ? 1 : 0);
    });
    return count;
  }
  visit(children.get(undefined) ?? [], [], true, false);
  return rows;
}
