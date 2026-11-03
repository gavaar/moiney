import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { PipeModel } from "@features/pipes/data/pipes";
import { usePipeCatalog } from "./PipeCatalogContext";
import { usePipeSelectionState } from "../PipeSelectionStateProvider/PipeSelectionStateProvider";

type PipeSelectionContextValue = ReturnType<typeof usePipeSelectionState> & {
  selectedPipe: PipeModel | null;
  selectedName: string | null;
};

const PipeSelectionContext = createContext<PipeSelectionContextValue | null>(null);

export function usePipeSelection(): PipeSelectionContextValue {
  const value = useContext(PipeSelectionContext);
  if (!value) {
    throw new Error("usePipeSelection must be used within PipeSelectionProvider");
  }
  return value;
}

export function PipeSelectionProvider({ children }: { children: ReactNode }) {
  const { allPipes } = usePipeCatalog();
  const { selectedPipePath: storedPath, selectPipe, deselectPipe } = usePipeSelectionState();
  const selectedPipePath = useMemo(() => {
    if (!allPipes) return storedPath;
    const existingIds = new Set(allPipes.map((pipe) => pipe.id));
    const firstMissingIndex = storedPath.findIndex((id) => !existingIds.has(id));
    return firstMissingIndex >= 0 ? storedPath.slice(0, firstMissingIndex) : storedPath;
  }, [allPipes, storedPath]);
  // Expose the surviving path immediately; synchronize the shared owner after
  // commit without overwriting a newer selection (for example, a deep link).
  useEffect(() => {
    if (selectedPipePath !== storedPath) {
      selectPipe(current => current === storedPath ? selectedPipePath : current);
    }
  }, [selectedPipePath, storedPath, selectPipe]);

  const selectedId =
    selectedPipePath.length > 0
      ? selectedPipePath[selectedPipePath.length - 1]
      : null;
  const selectedPipe = useMemo(
    () => (selectedId ? allPipes?.find((pipe) => pipe.id === selectedId) ?? null : null),
    [allPipes, selectedId],
  );
  const selectedName = selectedPipe?.name ?? null;

  const value = useMemo(
    () => ({
      selectedPipePath,
      selectPipe,
      deselectPipe,
      selectedPipe,
      selectedName,
    }),
    [selectedPipePath, selectPipe, deselectPipe, selectedPipe, selectedName],
  );

  return (
    <PipeSelectionContext.Provider value={value}>
      {children}
    </PipeSelectionContext.Provider>
  );
}
