import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { normalizePipe, type PipeModel } from "@features/pipes/data/pipes";

export type PipeCatalogContextValue = {
  allPipes: PipeModel[] | undefined;
  pipesById: Record<PipeModel["id"], PipeModel> | undefined;
  childrenByParent: Map<PipeModel["id"], PipeModel[]>;
  isLoading: boolean;
  feeds: PipeModel[];
};

const PipeCatalogContext = createContext<PipeCatalogContextValue | null>(null);

export function usePipeCatalog(): PipeCatalogContextValue {
  const value = useContext(PipeCatalogContext);
  if (!value) {
    throw new Error("usePipeCatalog must be used within PipeCatalogProvider");
  }
  return value;
}

export function PipeCatalogProvider({ children }: { children: ReactNode }) {
  const persistedPipes = useQuery(api.pipes.getPipes);
  const allPipes = useMemo(
    () => (persistedPipes ? persistedPipes.map(normalizePipe) : undefined),
    [persistedPipes],
  );
  const allPipesFlat = allPipes ?? [];

  const pipesById = useMemo(
    () =>
      Object.fromEntries(allPipesFlat.map((pipe) => [pipe.id, pipe])) as Record<
        PipeModel["id"],
        PipeModel
      >,
    [allPipesFlat],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<PipeModel["id"], PipeModel[]>();
    for (const pipe of allPipesFlat) {
      if (!pipe.parentId) continue;
      const siblings = map.get(pipe.parentId) ?? [];
      siblings.push(pipe);
      map.set(pipe.parentId, siblings);
    }
    for (const siblings of map.values()) {
      siblings.sort((left, right) => left.priority - right.priority);
    }
    return map;
  }, [allPipesFlat]);

  const feeds = useMemo(
    () =>
      allPipesFlat
        .filter((pipe) => pipe.parentId === undefined)
        .sort((left, right) => right.fed - left.fed),
    [allPipesFlat],
  );

  const value = useMemo(
    () => ({
      allPipes,
      pipesById,
      childrenByParent,
      isLoading: allPipes === undefined,
      feeds,
    }),
    [allPipes, pipesById, childrenByParent, feeds],
  );

  return (
    <PipeCatalogContext.Provider value={value}>
      {children}
    </PipeCatalogContext.Provider>
  );
}
