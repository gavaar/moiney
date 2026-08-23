import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PipeModel } from "@features/pipes/data/pipes";
import { usePipeCatalog } from "./PipeCatalogContext";

type PipeSelectionContextValue = {
  selectedPipePath: PipeModel["id"][];
  selectPipe: (path: PipeModel["id"][]) => void;
  deselectPipe: () => void;
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
  const [selectedPipePath, setSelectedPipePath] = useState<PipeModel["id"][]>([]);

  useEffect(() => {
    if (!allPipes) return;
    const existingIds = new Set(allPipes.map((pipe) => pipe.id));
    const firstMissingIndex = selectedPipePath.findIndex((id) => !existingIds.has(id));
    if (firstMissingIndex >= 0) {
      setSelectedPipePath((current) => current.slice(0, firstMissingIndex));
    }
  }, [allPipes, selectedPipePath]);

  const selectedId =
    selectedPipePath.length > 0
      ? selectedPipePath[selectedPipePath.length - 1]
      : null;
  const selectedPipe = useMemo(
    () => (selectedId ? allPipes?.find((pipe) => pipe.id === selectedId) ?? null : null),
    [allPipes, selectedId],
  );
  const selectedName = selectedPipe?.name ?? null;

  const selectPipe = useCallback(
    (path: PipeModel["id"][]) => setSelectedPipePath(path),
    [],
  );
  const deselectPipe = useCallback(() => setSelectedPipePath([]), []);

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
