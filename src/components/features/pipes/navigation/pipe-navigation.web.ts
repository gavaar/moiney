import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { useNavigationContainerRef, useRootNavigationState, type Href } from "expo-router";
import type { NavigationState } from "expo-router/react-navigation";
import { focusedRoute, readHistoryValue, writeLocalHistory } from "@/lib/navigation/local-history";
import type { PipeModel } from "../data/pipes";

type Path = PipeModel["id"][];
type Route = NavigationState["routes"][number];

function pipesIndex(state: NavigationState): Route | undefined {
  for (const route of state.routes) {
    if (route.state?.stale !== false) continue;
    if (route.name === "pipes") return route.state.routes.find(candidate => candidate.name === "index");
    const found = pipesIndex(route.state);
    if (found) return found;
  }
}

function savedPath(route: Route | undefined): Path | undefined {
  const value = route && readHistoryValue(route);
  // Only this adapter writes these snapshot values; URLs are resolved against
  // the catalog by PipesScreen, not cast into domain IDs here.
  return Array.isArray(value) && value.every(id => typeof id === "string") ? value as Path : undefined;
}

function equalPath(left: Path, right: Path) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function recordPath(navigation: ReturnType<typeof useNavigationContainerRef>, routeKey: string, next: Path, previous?: Path) {
  const write = (path: Path, operation: "push" | "replace" | "pop", count?: number) => {
    writeLocalHistory(navigation, routeKey, { operation, count, value: path, params: { pipeId: path.at(-1) } });
  };
  if (!previous) write([], "replace");
  let common = 0;
  const ancestry = previous ?? [];
  while (common < ancestry.length && common < next.length && ancestry[common] === next[common]) common++;
  if (ancestry.length > common) write(ancestry.slice(0, common), "pop", ancestry.length - common);
  for (let depth = common + 1; depth <= next.length; depth++) write(next.slice(0, depth), "push");
}

export function usePipeNavigation() {
  const navigation = useNavigationContainerRef();
  const root = useRootNavigationState();
  const route = root && pipesIndex(root);
  const routePath = savedPath(route);
  const active = !!root && !!route && focusedRoute(root).key === route.key;
  const [remembered, setRemembered] = useState<Path>([]);
  const [lastSnapshot, setLastSnapshot] = useState(routePath);
  const pending = useRef<{ routeKey: string; path: Path } | undefined>(undefined);
  if (routePath && routePath !== lastSnapshot) {
    setLastSnapshot(routePath);
    setRemembered(routePath);
  }
  const selectedPipePath = routePath ?? remembered;

  const selectPipe = useCallback((update: SetStateAction<Path>) => {
    const state = navigation.getRootState();
    const index = state && pipesIndex(state);
    const previous = pending.current?.routeKey === index?.key ? pending.current?.path : savedPath(index);
    const current = previous ?? remembered;
    const next = typeof update === "function" ? update(current) : update;
    if (previous && equalPath(current, next)) return;
    setRemembered(next);
    if (!state || !index) return;
    if (focusedRoute(state).key !== index.key) {
      writeLocalHistory(navigation, index.key, { operation: "replace", value: undefined, params: { pipeId: next.at(-1) } });
      return;
    }
    pending.current = { routeKey: index.key, path: next };
    recordPath(navigation, index.key, next, previous);
  }, [navigation, remembered]);

  const reconcilePipe = useCallback((update: SetStateAction<Path>) => {
    const state = navigation.getRootState();
    const index = state && pipesIndex(state);
    const current = (pending.current?.routeKey === index?.key ? pending.current?.path : savedPath(index)) ?? remembered;
    const next = typeof update === "function" ? update(current) : update;
    if (equalPath(current, next)) return;
    // Missing IDs truncate ancestry. Traversing to that surviving ancestor also
    // removes the invalid Back stops, rather than leaving duplicate parents.
    selectPipe(next);
  }, [navigation, remembered, selectPipe]);
  const deselectPipe = useCallback(() => selectPipe([]), [selectPipe]);

  useEffect(() => {
    if (!route) return;
    if (routePath && pending.current && equalPath(routePath, pending.current.path)) pending.current = undefined;
    if (!active && routePath) {
      pending.current = undefined;
      // A fresh visit needs its own ancestry. Historical snapshots keep theirs,
      // so browser Back/Forward can restore them without reseeding.
      writeLocalHistory(navigation, route.key, { operation: "replace", value: undefined });
    } else if (active && !routePath && !pending.current && remembered.length > 0 && (!route.params || !("pipeId" in route.params) || !route.params.pipeId || route.params.pipeId === remembered.at(-1))) {
      pending.current = { routeKey: route.key, path: remembered };
      recordPath(navigation, route.key, remembered);
    }
  }, [active, navigation, remembered, route, routePath]);

  return { selectedPipePath, selectPipe, deselectPipe, reconcilePipe };
}

export function getPipesHref(path: readonly PipeModel["id"][]): Href {
  return path.length ? { pathname: "/pipes", params: { pipeId: path.at(-1) } } : "/pipes";
}

export function getPipeOpeningRequest(pipeId: string | undefined, path: readonly PipeModel["id"][]) {
  return pipeId === path.at(-1) ? undefined : pipeId;
}

export function cleanupPipeRouterParams(_router: { setParams: (params: { pipeId: undefined }) => void }) {}
