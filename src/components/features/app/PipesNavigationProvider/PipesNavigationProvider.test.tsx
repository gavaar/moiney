// @vitest-environment jsdom
import { useReducer } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StackActions, StackRouter } from "expo-router/build/react-navigation/routers/StackRouter";
import type { StackActionType, StackNavigationState } from "expo-router/build/react-navigation/routers/StackRouter";
import { TabRouter } from "expo-router/build/react-navigation/routers/TabRouter";
import type { TabActionType, TabNavigationState } from "expo-router/build/react-navigation/routers/TabRouter";
import type { CommonNavigationAction, NavigationAction, NavigationState, ParamListBase } from "expo-router/build/react-navigation/routers/types";
import type { RouteNode } from "expo-router/build/Route";
import type { RouterRegistryEntry } from "expo-router/build/global-state/routerRegistry";
import { resolveNavigationDestination } from "expo-router/build/global-state/resolveNavigationDestination";
import { PipesNavigationProvider, useOpenPipes, usePipesStackReturn } from "./PipesNavigationProvider";
import { PipeSelectionStateProvider, usePipeSelectionState } from "@features/pipes/PipeSelectionStateProvider/PipeSelectionStateProvider";
import type { PipeModel } from "@features/pipes/data/pipes";

const boundary = vi.hoisted(() => ({ pathname: "/settings", dispatch: vi.fn<(type: "NAVIGATE" | "POP_TO") => void>() }));
vi.mock("expo-router", () => ({
  usePathname: () => boundary.pathname,
  useSegments: () => boundary.pathname === "/settings" ? ["(main)", "settings"] : ["(main)", "(tabs)", ...boundary.pathname.slice(1).split("/")],
  useRouter: () => ({ navigate: () => boundary.dispatch("NAVIGATE"), dismissTo: () => boundary.dispatch("POP_TO") }),
}));

function node(route: string, children: RouteNode[] = []): RouteNode {
  return { type: "route", route, children, dynamic: null, contextKey: route, loadRoute: () => ({}) };
}
const routeNode = node("", [
  node("(main)", [
    node("(tabs)", [
      node("pipes", [node("index"), node("current")]),
      node("history"),
      node("statistics", [node("index"), node("current"), node("[period-start]")]),
      node("profile"),
    ]),
    node("settings"),
  ]),
]);
const targetState = {
  routes: [
    {
      name: "(main)",
      state: {
        routes: [
          {
            name: "(tabs)",
            state: { routes: [{ name: "pipes", state: { routes: [{ name: "index" }] } }] },
          },
        ],
      },
    },
  ],
};

// Exercise the installed URL resolver AND stack/tab reducers. Mocking only
// router method names masks NAVIGATE duplication and unhandled tab POP_TO.
function navigationFixture(pathname: string, pipeNames: string[], coldSettings = false) {
  const registry = new Map<string, RouterRegistryEntry>();
  function make(key: string, type: "stack" | "tab", names: string[], index: number, routes: NavigationState["routes"]): NavigationState {
    const state: NavigationState = { stale: false, type, key, routeKeySeq: 20, routeNames: names, index, routes };
    const options = { routeNames: names, routeGetIdList: {} };
    // The framework registry erases the router-specific state/action correlation.
    registry.set(key, {
      reduce: (current, action) => type === "tab" ?
        TabRouter({}).getStateForAction(current as TabNavigationState<ParamListBase>, action as CommonNavigationAction | TabActionType, options) :
        StackRouter({}).getStateForAction(current as StackNavigationState<ParamListBase>, action as CommonNavigationAction | StackActionType, options),
    });
    return state;
  }
  const pipes = make("pipes-stack", "stack", ["index", "current"], pipeNames.length - 1,
    pipeNames.map((name, index) => ({ name, key: `${name}:pipes-${index}` })));
  const stats = make("stats-stack", "stack", ["index", "current", "[period-start]"], 1,
    [{ name: "index", key: "stats-index" }, { name: "current", key: "stats-report" }]);
  const tabNames = ["pipes", "history", "statistics", "profile"];
  const activeTab = pathname.split("/")[1];
  const tabs = make("tabs", "tab", tabNames, Math.max(0, tabNames.indexOf(activeTab)), [
    { name: "pipes", key: "pipes-tab", state: pipes },
    { name: "history", key: "history-tab" },
    { name: "statistics", key: "stats-tab", state: stats },
    { name: "profile", key: "profile-tab" },
  ]);
  const mainRoutes = coldSettings ? [{ name: "settings", key: "settings" }] : [
    { name: "(tabs)", key: "existing-tabs", state: tabs },
    ...(pathname === "/settings" ? [{ name: "settings", key: "settings" }] : []),
  ];
  const main = make("main", "stack", ["(tabs)", "settings"], mainRoutes.length - 1, mainRoutes);
  let root = make("root", "stack", ["(main)"], 0, [{ name: "(main)", key: "main", state: main }]);

  function apply(state: NavigationState, target: string, action: NavigationAction): NavigationState {
    if (state.key === target) {
      const result = registry.get(target)!.reduce(state, action);
      if (!result || typeof result !== "object") throw new Error(`Unhandled ${action.type} at ${target}`);
      return result.state;
    }
    return {
      ...state,
      routes: state.routes.map(route => route.state?.stale === false ?
        { ...route, state: apply(route.state, target, action) } : route),
    };
  }
  function findState(state: NavigationState, key: string): NavigationState | undefined {
    if (state.key === key) return state;
    for (const route of state.routes) {
      const found = route.state?.stale === false ? findState(route.state, key) : undefined;
      if (found) return found;
    }
  }
  function focusedNames(state: NavigationState): string[] {
    const route = state.routes[state.index];
    return [route.name, ...(route.state?.stale === false ? focusedNames(route.state) : [])];
  }
  return {
    expectedIndexKey: pipes.routes.find(route => route.name === "index")?.key,
    returnToIndex: () => { root = apply(root, pipes.key, StackActions.popTo("index")); },
    open: (type: "NAVIGATE" | "POP_TO") => {
      const action = resolveNavigationDestination({ targetState, navigationState: root, routeNode, registry, action: { type, payload: {} } });
      root = apply(root, action.target!, action);
    },
    focused: () => focusedNames(root).join("/"),
    pipeKeys: () => findState(root, "pipes-stack")?.routes.map(route => route.key).join(","),
  };
}

function Shortcut({ fixture, register }: { fixture: ReturnType<typeof navigationFixture>; register: boolean }) {
  const openPipes = useOpenPipes();
  return <>{register ? <PipesTarget fixture={fixture} /> : null}<button onClick={openPipes}>Pipes shortcut</button></>;
}
function PipesTarget({ fixture }: { fixture: ReturnType<typeof navigationFixture> }) {
  usePipesStackReturn(fixture.returnToIndex);
  return null;
}
function SharedSelectionControls() {
  const { selectedPipePath, selectPipe } = usePipeSelectionState();
  return <><button onClick={() => selectPipe(["root", "child"] as PipeModel["id"][])}>Select child</button>
    <output data-testid="shared-selection">{selectedPipePath.join(",") || "None"}</output></>;
}
function Fixture({ fixture, register = true }: { fixture: ReturnType<typeof navigationFixture>; register?: boolean }) {
  const [, refresh] = useReducer(value => value + 1, 0);
  boundary.dispatch.mockImplementation(type => { fixture.open(type); refresh(); });
  return <PipeSelectionStateProvider><PipesNavigationProvider>
    <SharedSelectionControls />
    <Shortcut fixture={fixture} register={register} />
    <output data-testid="active-path">{fixture.focused()}</output>
    <output data-testid="pipe-keys">{fixture.pipeKeys()}</output>
  </PipesNavigationProvider></PipeSelectionStateProvider>;
}

describe("Pipes shortcut navigator lifetime", () => {
  it("clears shared selection on reselect without a catalog or registered Pipes screen", () => {
    boundary.pathname = "/pipes";
    const fixture = navigationFixture(boundary.pathname, ["index"]);
    render(<Fixture fixture={fixture} register={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Select child" }));
    expect(screen.getByTestId("shared-selection").textContent).toBe("root,child");
    fireEvent.click(screen.getByRole("button", { name: "Pipes shortcut" }));
    expect(screen.getByTestId("shared-selection").textContent).toBe("None");
    expect(screen.getByTestId("pipe-keys").textContent).toBe(fixture.expectedIndexKey);
  });

  it.each(["/settings", "/pipes/current", "/history", "/profile", "/statistics", "/statistics/current", "/statistics/2026-10-01"])(
    "returns from %s to the existing Pipes index, including an inactive report stack", pathname => {
      boundary.pathname = pathname;
      const fixture = navigationFixture(pathname, ["index", "current"]);
      render(<Fixture fixture={fixture} />);
      fireEvent.click(screen.getByRole("button", { name: "Select child" }));
      fireEvent.click(screen.getByRole("button", { name: "Pipes shortcut" }));
      expect(screen.getByTestId("active-path").textContent).toBe("(main)/(tabs)/pipes/index");
      expect(screen.getByTestId("pipe-keys").textContent).toBe(fixture.expectedIndexKey);
      expect(screen.getByTestId("shared-selection").textContent).toBe("root,child");
    });

  it("keeps an existing index even when a cold report precedes it in the inactive Pipes stack", () => {
    boundary.pathname = "/history";
    const fixture = navigationFixture(boundary.pathname, ["current", "index", "current"]);
    render(<Fixture fixture={fixture} />);
    fireEvent.click(screen.getByRole("button", { name: "Pipes shortcut" }));
    expect(screen.getByTestId("active-path").textContent).toBe("(main)/(tabs)/pipes/index");
    expect(screen.getByTestId("pipe-keys").textContent).toBe(`current:pipes-0,${fixture.expectedIndexKey}`);
  });

  it.each(["/settings", "/history", "/pipes/current"])("opens Pipes from a cold %s entry without a registered screen", pathname => {
    boundary.pathname = pathname;
    const fixture = navigationFixture(pathname, ["current"], pathname === "/settings");
    render(<Fixture fixture={fixture} register={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Pipes shortcut" }));
    expect(screen.getByTestId("active-path").textContent).toBe("(main)/(tabs)/pipes/index");
  });
});
