import { StackRouter } from "expo-router/build/react-navigation/routers/StackRouter";
import type { StackNavigationState } from "expo-router/build/react-navigation/routers/StackRouter";
import type { NavigationAction, NavigationState, ParamListBase, Router } from "expo-router/react-navigation";
import { indexNavigationTree, reduceNavigationTree, resolveOrigin } from "expo-router/build/global-state/reduceNavigationTree";
import type { RouterRegistryEntry } from "expo-router/build/global-state/routerRegistry";
import { localHistoryRouter } from "./local-history";

export function createHistoryFixture() {
  const options = { routeNames: ["pipes", "history"], routeGetIdList: {} };
  const pipes: StackNavigationState<ParamListBase> = {
    stale: false,
    type: "stack",
    key: "pipes-stack",
    routeKeySeq: 1,
    routeNames: ["index", "current"],
    index: 0,
    routes: [{ name: "index", key: "pipes-index" }],
  };
  const application: StackNavigationState<ParamListBase> = {
    ...pipes,
    key: "application-stack",
    routeNames: options.routeNames,
    routes: [{ name: "pipes", key: "pipes-route", state: pipes }],
  };
  let state: StackNavigationState<ParamListBase> = {
    ...application,
    key: "expo-outer-root",
    routeNames: ["__root"],
    routes: [{ name: "__root", key: "application-layout", state: application }],
  };
  const original: Router<StackNavigationState<ParamListBase>, NavigationAction> = StackRouter({});
  const router = { ...original, ...localHistoryRouter(original) };
  const registry = new Map<string, RouterRegistryEntry>();
  const register = (key: string, implementation: typeof original, routeNames: string[]) => {
    registry.set(key, {
      reduce: (current, action) => implementation.getStateForAction({ ...current, type: "stack" }, action, { routeNames, routeGetIdList: {} }),
      shouldActionChangeFocus: implementation.shouldActionChangeFocus,
      getStateForRouteFocus: (current, routeKey) => implementation.getStateForRouteFocus({ ...current, type: "stack" }, routeKey),
      getBrowserHistoryForRouteFocus: (previous, next, childAction) => implementation.getBrowserHistoryForRouteFocus?.({ ...previous, type: "stack" }, { ...next, type: "stack" }, childAction),
    });
  };
  register(state.key, original, state.routeNames);
  register(application.key, router, application.routeNames);
  register(pipes.key, original, pipes.routeNames);
  let entries = [state];
  let index = 0;
  let render = () => {};
  let fallthroughs = 0;
  const listeners = new Set<(event: { data: { state: NavigationState } }) => void>();
  const dispatch = (action: NavigationAction) => {
    const tree = indexNavigationTree(state);
    const origin = resolveOrigin(tree.rootNode, tree.nodes, registry);
    if (!origin) throw new Error("Missing navigation origin");
    const result = reduceNavigationTree(action, registry, { origin, tree });
    if (!result.handled) throw new Error(`Unhandled ${action.type}`);
    state = { ...result.nextState, type: "stack" };
    if (action.type !== "RESET") {
      if (result.browserHistory?.type === "push") {
        entries = [...entries.slice(0, index + 1), state];
        index++;
      } else if (result.browserHistory?.type === "pop") index -= result.browserHistory.count;
    }
    if (index < 0) throw new Error("History escaped its ancestry");
    entries[index] = state;
    render();
  };
  return {
    get state() { return state; },
    get index() { return index; },
    get fallthroughs() { return fallthroughs; },
    get entries() { return entries; },
    navigation: {
      getRootState: () => state,
      dispatch,
      addListener: (_name: string, listener: (event: { data: { state: NavigationState } }) => void) => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
    },
    setRender: (callback: () => void) => { render = callback; },
    emit: (snapshot: NavigationState) => listeners.forEach(listener => listener({ data: { state: snapshot } })),
    back: () => {
      if (index === 0) { fallthroughs++; return; }
      index--;
      dispatch({ type: "RESET", payload: entries[index] });
    },
    forward: () => {
      if (index === entries.length - 1) return;
      index++;
      dispatch({ type: "RESET", payload: entries[index] });
    },
  };
}
