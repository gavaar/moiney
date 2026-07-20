import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { type Id, type Doc } from "@convex/_generated/dataModel";

export type Pipe = {
  _id: Id<"pipes">;
  name: string;
  icon: string;
  capacity: number;
  fed: number;
  spent: number;
};

type PipeSelectionContextValue = {
  selectedPipePath: Id<"pipes">[];
  selectPipe: (path: Id<"pipes">[]) => void;
  deselectPipe: () => void;
  allPipes: Doc<"pipes">[] | undefined;
  pipesById: Record<Id<"pipes">, Doc<"pipes">> | undefined;
  childrenByParent: Map<Id<"pipes">, Doc<"pipes">[]>;
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

function toPipe(doc: Doc<"pipes">): Pipe {
  return {
    _id: doc._id,
    name: doc.name,
    icon: doc.icon,
    capacity: doc.capacity ?? 0,
    fed: doc.fed ?? 0,
    spent: doc.spent ?? 0,
  };
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
    return map;
  }, [allPipesFlat]);

  const feeds = allPipesFlat
    .filter((p) => p.parentId === undefined)
    .map(toPipe);

  const selectedId =
    selectedPipePath.length > 0
      ? selectedPipePath[selectedPipePath.length - 1]
      : null;
  const selectedPipeData = selectedId
    ? allPipesFlat.find((p) => p._id === selectedId) ?? null
    : null;
  const selectedPipe = selectedPipeData ? toPipe(selectedPipeData) : null;
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
