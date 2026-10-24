export type SelectGroup = {
  id: string;
  name: string;
  icon?: string;
  itemIds: readonly string[];
  initiallyExpanded?: boolean;
};

export type SelectRow<Item> =
  | { key: string; kind: "option"; item: Item; grouped?: boolean }
  | { key: string; kind: "group"; group: SelectGroup };

/** Keeps ungrouped options first and omits groups with no available members. */
export function buildSelectRows<Item extends { id: string }>(
  items: readonly Item[],
  groups: readonly SelectGroup[] = [],
  expandedOverrides: Readonly<Record<string, boolean>> = {},
): SelectRow<Item>[] {
  const groupedIds = new Set(groups.flatMap(group => group.itemIds));
  const itemsById = new Map(items.map(item => [item.id, item]));

  return [
    ...items.filter(item => !groupedIds.has(item.id)).map(item => ({ key: `item:${item.id}`, kind: "option" as const, item })),
    ...groups.flatMap(group => {
      const members = group.itemIds.flatMap(id => {
        const item = itemsById.get(id);
        return item ? [item] : [];
      });
      if (members.length === 0) return [];
      return [
        { key: `group:${group.id}`, kind: "group" as const, group },
        ...((expandedOverrides[group.id] ?? group.initiallyExpanded ?? false)
          ? members.map(item => ({ key: `item:${item.id}`, kind: "option" as const, item, grouped: true })) : []),
      ];
    }),
  ];
}
