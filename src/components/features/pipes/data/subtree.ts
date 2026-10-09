import type { PipeModel } from "./pipes";

export function getSubtreePipeIds(
  childrenByParent: Map<PipeModel["id"], PipeModel[]>,
  selectedPipeId: PipeModel["id"] | null,
): PipeModel["id"][] | null {
  if (!selectedPipeId) return null;

  const result: PipeModel["id"][] = [];
  function dfs(nodeId: PipeModel["id"]) {
    result.push(nodeId);
    const nodeChildren = childrenByParent.get(nodeId);
    if (nodeChildren) {
      for (const child of nodeChildren) {
        dfs(child.id);
      }
    }
  }
  dfs(selectedPipeId);
  return result;
}
