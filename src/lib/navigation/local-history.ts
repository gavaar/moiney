import type { ComponentProps } from "react";
import type { Stack } from "expo-router";
import type { NavigationAction, NavigationState } from "expo-router/react-navigation";
import { INTERNAL_SLOT_NAME } from "expo-router/build/constants";

type HistoryChange = {
  operation: "push" | "replace" | "pop";
  count?: number;
  params?: object;
  value?: unknown;
  dismissalId?: string | null;
};

type RootNavigation = {
  getRootState: () => NavigationState | undefined;
  dispatch: (action: NavigationAction) => void;
};

export function writeLocalHistory(navigation: RootNavigation, routeKey: string, change: HistoryChange) {
  const root = navigation.getRootState();
  if (!root) return;
  // The framework owns the outer root. Our override belongs to the application
  // layout's Stack, immediately below its internal layout slot.
  const application = root.routes.find(route => route.name === INTERNAL_SLOT_NAME)?.state;
  if (application?.stale !== false) return;
  navigation.dispatch({ type: "LOCAL_HISTORY", target: application.key, payload: { ...change, routeKey } });
}

export function readHistoryValue(route: object): unknown {
  return "localHistoryValue" in route ? route.localHistoryValue : undefined;
}

export function readDismissalId(route: object) {
  return "backDismissalId" in route && typeof route.backDismissalId === "string" ? route.backDismissalId : undefined;
}

export function focusedRoute(state: NavigationState): NavigationState["routes"][number] {
  const route = state.routes[state.index];
  return route.state?.stale === false ? focusedRoute(route.state) : route;
}

function updateRoute(state: NavigationState, routeKey: string, change: object): NavigationState {
  return {
    ...state,
    routes: state.routes.map(route => {
      if (route.key === routeKey) return { ...route, ...change };
      if (route.state?.stale !== false) return route;
      return { ...route, state: updateRoute(route.state, routeKey, change) };
    }),
  };
}

function findRoute(state: NavigationState, routeKey: string): NavigationState["routes"][number] | undefined {
  for (const route of state.routes) {
    if (route.key === routeKey) return route;
    if (route.state?.stale === false) {
      const found = findRoute(route.state, routeKey);
      if (found) return found;
    }
  }
}

// Expo Router owns both history snapshots and browser writes. A local entry
// changes route data, not route identity, so forms and view state stay mounted.
// Only the web adapters dispatch LOCAL_HISTORY; native navigation passes through.
export const localHistoryRouter: NonNullable<ComponentProps<typeof Stack>["UNSTABLE_router"]> = original => ({
  getStateForAction(state, action, options) {
    const payload = action.payload;
    if (action.type !== "LOCAL_HISTORY" || !payload || !("routeKey" in payload) || typeof payload.routeKey !== "string" ||
      !("operation" in payload) || (payload.operation !== "push" && payload.operation !== "pop" && payload.operation !== "replace")) {
      return original.getStateForAction(state, action, options);
    }
    const route = findRoute(state, payload.routeKey);
    if (!route) return { state, affectedRouteKey: undefined };
    const params = "params" in payload && payload.params !== null && typeof payload.params === "object" ? payload.params : undefined;
    const change = {
      ...(params ? { params: { ...route.params, ...params }, backDismissalId: undefined } : {}),
      ...("value" in payload ? { localHistoryValue: payload.value } : {}),
      ...("dismissalId" in payload ? { backDismissalId: payload.dismissalId ?? undefined } : {}),
    };
    const updated = updateRoute(state, route.key, change);
    return {
      state: { ...state, routes: updated.routes },
      affectedRouteKey: state.routes[state.index].key,
      browserHistory: payload.operation === "pop" ? {
        type: "pop",
        count: "count" in payload && typeof payload.count === "number" ? payload.count : 1,
      } : { type: payload.operation },
    };
  },
});
