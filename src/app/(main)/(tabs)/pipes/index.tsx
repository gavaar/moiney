import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PipesScreen } from "@features/pipes/PipesScreen";

export default function PipesRoute() {
  const { pipeId } = useLocalSearchParams<{ pipeId?: string }>();
  const router = useRouter();
  const onPipeOpened = useCallback(() => router.setParams({ pipeId: undefined }), [router]);
  return <PipesScreen openPipeId={pipeId} onPipeOpened={onPipeOpened} />;
}
