import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { type Id, type Doc } from "@convex/_generated/dataModel";

export type Pipe = Doc<"pipes"> & {
  deletionJobId?: Id<"pipeDeletionJobs">;
};

type PipeSelectionContextValue = {
  selectedPipePath: Id<"pipes">[];
  selectPipe: (path: Id<"pipes">[]) => void;
  deselectPipe: () => void;
  allPipes: Pipe[] | undefined;
  pipesById: Record<Id<"pipes">, Pipe> | undefined;
  childrenByParent: Map<Id<"pipes">, Pipe[]>;
  isLoading: boolean;
  feeds: Pipe[];
  selectedPipe: Pipe | null;
  selectedName: string | null;
};

const defaultVal: PipeSelectionContextValue = {
  selectedPipePath: [],
  selectPipe: () => {},
  deselectPipe: () => {},
  allPipes: undefined,
  pipesById: undefined,
  childrenByParent: new Map(),
  isLoading: true,
  feeds: [],
  selectedPipe: null,
  selectedName: null,
};

const PipeSelectionContext = createContext<PipeSelectionContextValue>(defaultVal);

export function usePipeSelection() {
  return useContext(PipeSelectionContext);
}

export function PipeSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedPipePath, setSelectedPipePath] = useState<Id<"pipes">[]>([]);
  const allPipes = useQuery(api.pipes.getPipes);

  const isLoading = allPipes === undefined;

  const allPipesFlat = allPipes ?? [];

  useEffect(() => {
    if (!allPipes) return;
    const existingIds = new Set(allPipes.map((pipe) => pipe._id));
    const firstMissingIndex = selectedPipePath.findIndex((id) => !existingIds.has(id));
    if (firstMissingIndex >= 0) {
      setSelectedPipePath((current) => current.slice(0, firstMissingIndex));
    }
  }, [allPipes, selectedPipePath]);

  const pipesById = useMemo(
    () => Object.fromEntries(allPipesFlat.map((p) => [p._id, p])) as Record<Id<"pipes">, Pipe>,
    [allPipesFlat],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<Id<"pipes">, Pipe[]>();
    for (const pipe of allPipesFlat) {
      if (pipe.parentId) {
        const siblings = map.get(pipe.parentId) ?? [];
        siblings.push(pipe);
        map.set(pipe.parentId, siblings);
      }
    }
    for (const siblings of map.values()) {
      siblings.sort((a, b) => a.priority - b.priority);
    }
    return map;
  }, [allPipesFlat]);

  const feeds = useMemo(
    () =>
      allPipesFlat
        .filter((p) => p.parentId === undefined)
        .sort((a, b) => b.fed - a.fed),
    [allPipesFlat],
  );

  const selectedId =
    selectedPipePath.length > 0
      ? selectedPipePath[selectedPipePath.length - 1]
      : null;
  const selectedPipe = useMemo(
    () => (selectedId ? allPipesFlat.find((p) => p._id === selectedId) ?? null : null),
    [allPipesFlat, selectedId],
  );
  const selectedName = selectedPipe?.name ?? null;

  const selectPipe = useCallback((path: Id<"pipes">[]) => setSelectedPipePath(path), []);
  const deselectPipe = useCallback(() => setSelectedPipePath([]), []);

  const value = useMemo(
    () => ({
      selectedPipePath,
      selectPipe,
      deselectPipe,
      allPipes,
      pipesById,
      childrenByParent,
      isLoading,
      feeds,
      selectedPipe,
      selectedName,
    }),
    [
      selectedPipePath,
      selectPipe,
      deselectPipe,
      allPipes,
      pipesById,
      childrenByParent,
      isLoading,
      feeds,
      selectedPipe,
      selectedName,
    ],
  );

  return (
    <PipeSelectionContext.Provider value={value}>
      {children}
    </PipeSelectionContext.Provider>
  );
}
