import { useMemo } from "react";
import { DimensionValue, Pressable, ScrollView, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import type { PipeModel } from "@features/pipes/data/pipes";
import { colors } from "@/lib/styles";

const BAR_WIDTH = 100;

type TreeRowData = {
  id: PipeModel["id"];
  depth: number;
  prefix: string;
  pipe: PipeModel;
  groupMax: number;
  path: PipeModel["id"][];
  isLeaf: boolean;
};

function buildPrefix(depth: number, hasMoreSiblings: boolean[], isLastChild: boolean): string {
  if (depth === 0) return "";
  let s = "";
  for (let i = 1; i < depth; i++) {
    s += hasMoreSiblings[i] ? "\u2502   " : "    ";
  }
  s += isLastChild ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
  return s;
}

function buildTreeRows(
  feeds: PipeModel[],
  childrenByParent: Map<PipeModel["id"], PipeModel[]>,
): TreeRowData[] {
  const rows: TreeRowData[] = [];

  function groupMax(pipes: PipeModel[]): number {
    let m = 0;
    for (const p of pipes) {
      const childPipes = childrenByParent.get(p.id);
      if (childPipes === undefined || childPipes.length === 0) {
        m = Math.max(m, Math.abs(p.fed), Math.abs(p.spent), Math.abs(p.capacity));
      }
    }
    return m || 1;
  }

  function sortSiblings(pipes: PipeModel[]): PipeModel[] {
    return [...pipes].sort((a, b) => {
      const aLeaf = !childrenByParent.has(a.id) || (childrenByParent.get(a.id)?.length ?? 0) === 0;
      const bLeaf = !childrenByParent.has(b.id) || (childrenByParent.get(b.id)?.length ?? 0) === 0;
      if (aLeaf && !bLeaf) return -1;
      if (!aLeaf && bLeaf) return 1;
      if (aLeaf && bLeaf) return Math.max(Math.abs(b.fed), Math.abs(b.spent)) - Math.max(Math.abs(a.fed), Math.abs(a.spent));
      return 0;
    });
  }

  function dfs(pipes: PipeModel[], depth: number, hasMoreSiblings: boolean[], gMax: number, parentPath: PipeModel["id"][]) {
    const sorted = sortSiblings(pipes);
    for (let i = 0; i < sorted.length; i++) {
      const pipe = sorted[i];
      const isLastChild = i === sorted.length - 1;
      const path = [...parentPath, pipe.id];

      const children = childrenByParent.get(pipe.id);
      const hasChildren = children !== undefined && children.length > 0;

      rows.push({
        id: pipe.id,
        depth,
        prefix: buildPrefix(depth, hasMoreSiblings, isLastChild),
        pipe,
        groupMax: gMax,
        path,
        isLeaf: !hasChildren,
      });

      if (hasChildren) {
        dfs(children, depth + 1, [...hasMoreSiblings, !isLastChild], groupMax(children), path);
      }
    }
  }

  dfs(feeds, 0, [], groupMax(feeds), []);
  return rows;
}

type PipeTreeViewProps = {
  onSelectPipe: (path: PipeModel["id"][]) => void;
};

export function PipeTreeView({ onSelectPipe }: PipeTreeViewProps) {
  const { feeds, childrenByParent } = usePipeSelection();

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
    <ScrollView className="flex-1">
      {rows.map((row) => (
        <TreeRow key={row.id} row={row} onPress={() => onSelectPipe(row.path)} />
      ))}
    </ScrollView>
  );
}

function TreeRow({ row, onPress }: { row: TreeRowData; onPress: () => void }) {
  const { prefix, pipe, groupMax, isLeaf } = row;

  return (
    <Pressable onPress={onPress} className="flex-row items-center py-1">
      <View className="flex-1 flex-row items-center">
        <Text className="text-muted font-mono text-sm shrink-0">{prefix}</Text>
        <Icon name={pipe.icon as any} size={18} />
        <Text className="text-text text-base ml-1 shrink" numberOfLines={1}>
          {pipe.name}
        </Text>
      </View>
      {isLeaf && <MiniBar fed={pipe.fed} spent={pipe.spent} capacity={pipe.capacity} maxVal={groupMax} />}
    </Pressable>
  );
}

function MiniBar({
  fed,
  spent,
  capacity,
  maxVal,
}: {
  fed: number;
  spent: number;
  capacity: number;
  maxVal: number;
}) {
  const hasNegative = fed < 0 || capacity < 0;
  const hasPositive = fed > 0 || capacity > 0 || spent > 0;

  const pHalf = (v: number) => `${(v / maxVal) * 100}%` as DimensionValue;

  return (
    <View
      className="flex-row rounded-sm overflow-hidden"
      style={{ width: BAR_WIDTH, height: 8 }}
    >
      {hasNegative && (
        <View
          className="relative overflow-hidden"
          style={{ flex: 1, flexDirection: "row-reverse" }}
        >
          {capacity < 0 && (
            <View
              style={{
                width: pHalf(Math.abs(capacity)),
                backgroundColor: colors.errorDark,
                height: 8,
              }}
            />
          )}
          {fed < 0 && (
            <View
              style={{
                position: "absolute", right: 0, top: 0,
                width: pHalf(Math.abs(fed)),
                backgroundColor: colors.error,
                height: 8,
              }}
            />
          )}
          {fed < 0 && spent > 0 && (
            <View
              style={{
                position: "absolute", right: 0, top: 0,
                width: pHalf(spent),
                backgroundColor: `${colors.errorBright}CC`,
                height: 8,
              }}
            />
          )}
        </View>
      )}

      <View style={{ width: 1, backgroundColor: colors.text }} />

      {hasPositive && (
        <View
          className="flex-row overflow-hidden"
          style={{ flex: 1 }}
        >
          {spent > 0 && (
            <View style={{ width: pHalf(spent), backgroundColor: colors.error, height: 8 }} />
          )}
          {fed >= 0 && (
            <View
              style={{
                width: pHalf(Math.max(0, fed - spent)),
                backgroundColor: colors.success,
                height: 8,
              }}
            />
          )}
          {capacity > 0 && (
            <View
              style={{
                width: pHalf(Math.max(0, capacity - fed)),
                backgroundColor: "#413f3f",
                height: 8,
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}
