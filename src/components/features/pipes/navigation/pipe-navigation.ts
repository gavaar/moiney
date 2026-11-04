import { useCallback, useState } from "react";
import type { PipeModel } from "../data/pipes";

export function usePipeNavigation() {
  const [selectedPipePath, selectPipe] = useState<PipeModel["id"][]>([]);
  const deselectPipe = useCallback(() => selectPipe([]), []);
  return { selectedPipePath, selectPipe, deselectPipe, reconcilePipe: selectPipe };
}

export function getPipesHref(_path: readonly PipeModel["id"][]) {
  return "/pipes" as const;
}

export function getPipeOpeningRequest(pipeId: string | undefined, _path: readonly PipeModel["id"][]) {
  return pipeId;
}

export function cleanupPipeRouterParams(router: { setParams: (params: { pipeId: undefined }) => void }) {
  router.setParams({ pipeId: undefined });
}
