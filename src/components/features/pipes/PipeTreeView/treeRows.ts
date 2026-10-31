import type { PipeModel } from "@features/pipes/data/pipes";
import type { TreeBranchPath } from "@ui/TreeBranch";

export type TreeRowData = {
  id: PipeModel["id"];
  depth: number;
  branch: TreeBranchPath;
  pipe: PipeModel;
  groupMax: number;
  path: PipeModel["id"][];
  isLeaf: boolean;
};

export function buildTreeRows(
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

  function dfs(
    pipes: PipeModel[],
    depth: number,
    parentBranch: TreeBranchPath,
    gMax: number,
    parentPath: PipeModel["id"][],
  ) {
    const sorted = sortSiblings(pipes);
    for (let i = 0; i < sorted.length; i++) {
      const pipe = sorted[i];
      const isLastChild = i === sorted.length - 1;
      const branch: TreeBranchPath = depth === 0 ? [] : [...parentBranch, !isLastChild];
      const path = [...parentPath, pipe.id];

      const children = childrenByParent.get(pipe.id);
      const hasChildren = children !== undefined && children.length > 0;

      rows.push({
        id: pipe.id,
        depth,
        branch,
        pipe,
        groupMax: gMax,
        path,
        isLeaf: !hasChildren,
      });

      if (hasChildren) {
        dfs(children, depth + 1, branch, groupMax(children), path);
      }
    }
  }

  dfs(feeds, 0, [], groupMax(feeds), []);
  return rows;
}
