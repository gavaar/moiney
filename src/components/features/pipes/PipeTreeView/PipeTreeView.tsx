import { useMemo } from "react";
import { DimensionValue, Pressable, ScrollView, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { usePipeSelection, type Pipe } from "@features/pipes/context/PipeSelectionContext";
import { colors } from "@/lib/styles";
import { type Id } from "@convex/_generated/dataModel";

const BAR_WIDTH = 100;
const MONO_W = 8.4;
const NAME_W = 9.6;

type TreeRowData = {
  id: Id<"pipes">;
  depth: number;
  prefix: string;
  pipe: Pipe;
  groupMax: number;
  path: Id<"pipes">[];
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
  feeds: Pipe[],
  childrenByParent: Map<Id<"pipes">, Pipe[]>,
): TreeRowData[] {
  const rows: TreeRowData[] = [];

  function groupMax(pipes: Pipe[]): number {
    let m = 0;
    for (const p of pipes) {
      const childPipes = childrenByParent.get(p._id);
      if (childPipes === undefined || childPipes.length === 0) {
        m = Math.max(m, Math.abs(p.fed), Math.abs(p.spent), Math.abs(p.capacity));
      }
    }
    return m || 1;
  }

  function sortSiblings(pipes: Pipe[]): Pipe[] {
    return [...pipes].sort((a, b) => {
      const aLeaf = !childrenByParent.has(a._id) || (childrenByParent.get(a._id)?.length ?? 0) === 0;
      const bLeaf = !childrenByParent.has(b._id) || (childrenByParent.get(b._id)?.length ?? 0) === 0;
      if (aLeaf && !bLeaf) return -1;
      if (!aLeaf && bLeaf) return 1;
      if (aLeaf && bLeaf) return Math.max(Math.abs(b.fed), Math.abs(b.spent)) - Math.max(Math.abs(a.fed), Math.abs(a.spent));
      return 0;
    });
  }

  function dfs(pipes: Pipe[], depth: number, hasMoreSiblings: boolean[], gMax: number, parentPath: Id<"pipes">[]) {
    const sorted = sortSiblings(pipes);
    for (let i = 0; i < sorted.length; i++) {
      const pipe = sorted[i];
      const isLastChild = i === sorted.length - 1;
      const path = [...parentPath, pipe._id];

      const children = childrenByParent.get(pipe._id);
      const hasChildren = children !== undefined && children.length > 0;

      rows.push({
        id: pipe._id,
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

function maxLeftWidth(rows: TreeRowData[]): number {
  let max = 0;
  for (const row of rows) {
    const w = row.prefix.length * MONO_W + 18 + row.pipe.name.length * NAME_W + 4;
    if (w > max) max = w;
  }
  return max;
}

type PipeTreeViewProps = {
  onSelectPipe: (path: Id<"pipes">[]) => void;
};

export function PipeTreeView({ onSelectPipe }: PipeTreeViewProps) {
  const { feeds, childrenByParent } = usePipeSelection();

  const childPipesById = useMemo(() => {
    const map = new Map<Id<"pipes">, Pipe[]>();
    for (const [parentId, docs] of childrenByParent) {
      map.set(parentId, docs);
    }
    return map;
  }, [childrenByParent]);

  const { rows, leftWidth } = useMemo(() => {
    const rows = buildTreeRows(feeds, childPipesById);
    const leftWidth = maxLeftWidth(rows);
    return { rows, leftWidth };
  }, [feeds, childPipesById]);

  return (
    <ScrollView className="flex-1">
      {rows.map((row) => (
        <TreeRow key={row.id} row={row} leftWidth={leftWidth} onPress={() => onSelectPipe(row.path)} />
      ))}
    </ScrollView>
  );
}

function TreeRow({ row, leftWidth, onPress }: { row: TreeRowData; leftWidth: number; onPress: () => void }) {
  const { prefix, pipe, groupMax, isLeaf } = row;

  return (
    <Pressable onPress={onPress} className="flex-row items-center py-1">
      <View className="flex-row items-center" style={{ width: leftWidth }}>
        <Text className="text-muted font-mono text-sm">{prefix}</Text>
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
