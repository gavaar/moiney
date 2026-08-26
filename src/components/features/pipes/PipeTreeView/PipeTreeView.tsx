import { useMemo } from "react";
import { FlatList } from "react-native";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { PipeModel } from "@features/pipes/data/pipes";
import { TreeRow } from "./TreeRow";
import { buildTreeRows } from "./treeRows";

type PipeTreeViewProps = {
  onSelectPipe: (path: PipeModel["id"][]) => void;
};

export function PipeTreeView({ onSelectPipe }: PipeTreeViewProps) {
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

  return (
    <FlatList
      className="flex-1"
      data={rows}
      keyExtractor={(row) => String(row.id)}
      renderItem={({ item }) => (
        <TreeRow row={item} onPress={() => onSelectPipe(item.path)} />
      )}
    />
  );
}
