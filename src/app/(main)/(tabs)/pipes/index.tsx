import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PipesScreen } from "@features/pipes/PipesScreen";
import { usePipeSelectionState } from "@features/pipes/PipeSelectionStateProvider/PipeSelectionStateProvider";
import { cleanupPipeRouterParams, getPipeOpeningRequest } from "@features/pipes/navigation/pipe-navigation";

export default function PipesRoute() {
  const { pipeId } = useLocalSearchParams<{ pipeId?: string }>();
  const router = useRouter();
  const { selectedPipePath } = usePipeSelectionState();
  const onPipeOpened = useCallback(() => cleanupPipeRouterParams(router), [router]);
  return <PipesScreen openPipeId={getPipeOpeningRequest(pipeId, selectedPipePath)} onPipeOpened={onPipeOpened} onOpenCurrentReport={() => router.push("/pipes/current")} />;
}
