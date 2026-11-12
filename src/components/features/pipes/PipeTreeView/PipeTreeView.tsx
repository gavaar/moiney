import { useMemo } from "react";
import { formatMoneyInput } from "@domain/money";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { PipeModel } from "@features/pipes/data/pipes";
import { PipeTreeItem } from "@features/pipes/PipeTree";
import { TreeList, type TreeCollapse } from "@ui/TreeList";
import { MiniBar } from "./components/MiniBar/MiniBar";
import { buildTreeRows } from "./treeRows";

type PipeTreeViewProps = {
  onSelectPipe: (path: PipeModel["id"][]) => void;
  collapse?: TreeCollapse;
};

export function PipeTreeView({ onSelectPipe, collapse }: PipeTreeViewProps) {
  const { feeds, childrenByParent } = usePipeCatalog();

  const childPipesById = useMemo(() => {
    const map = new Map<PipeModel["id"], PipeModel[]>();
    for (const [parentId, docs] of childrenByParent) {
      map.set(parentId, docs);
    }
    return map;
  }, [childrenByParent]);

  const rows = useMemo(() => buildTreeRows(feeds, childPipesById), [
    feeds,
    childPipesById,
  ]);

  return <TreeList
    items={rows}
    collapse={collapse}
    tree={rows.map(row => ({ id: row.id, label: row.pipe.name, parentId: row.path.at(-2), selectable: true }))}
    onPress={row => onSelectPipe(row.path)}
    itemAccessibilityLabel={({ pipe }) => `${pipe.name}. Fed ${formatMoneyInput(pipe.fed)}. Spent ${formatMoneyInput(pipe.spent)}. Capacity ${formatMoneyInput(pipe.capacity)}.`}
    renderItem={(row, state) => <PipeTreeItem pipe={row.pipe} state={state}>
      {row.isLeaf ? <MiniBar fed={row.pipe.fed} spent={row.pipe.spent} capacity={row.pipe.capacity} maxVal={row.groupMax} /> : null}
    </PipeTreeItem>}
  />;
}
