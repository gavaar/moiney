import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { type Id, type Doc } from "@convex/_generated/dataModel";

export type Pipe = Doc<"pipes">;

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

  const pipesById = useMemo(
    () => Object.fromEntries(allPipesFlat.map((p) => [p._id, p])) as Record<Id<"pipes">, Doc<"pipes">>,
    [allPipesFlat],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<Id<"pipes">, Doc<"pipes">[]>();
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

  const feeds = allPipesFlat
    .filter((p) => p.parentId === undefined)
    .sort((a, b) => b.fed - a.fed);

  const selectedId =
    selectedPipePath.length > 0
      ? selectedPipePath[selectedPipePath.length - 1]
      : null;
  const selectedPipe = selectedId
    ? allPipesFlat.find((p) => p._id === selectedId) ?? null
    : null;
  const selectedName = selectedPipe?.name ?? null;

  const selectPipe = (path: Id<"pipes">[]) => setSelectedPipePath(path);
  const deselectPipe = () => setSelectedPipePath([]);

  return (
    <PipeSelectionContext.Provider
      value={{
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
      }}
    >
      {children}
    </PipeSelectionContext.Provider>
  );
}
