import { describe, expect, it } from "vitest";
import { StackActions, StackRouter } from "expo-router/build/react-navigation/routers/StackRouter";
import type { StackNavigationState } from "expo-router/build/react-navigation/routers/StackRouter";
import type { NavigationAction, ParamListBase, Router } from "expo-router/react-navigation";
import { localHistoryRouter, writeLocalHistory } from "./local-history";
import { createHistoryFixture } from "./local-history.test-fixture";

describe("router-owned local history", () => {
  it("leaves ordinary native stack navigation unchanged", () => {
    const original: Router<StackNavigationState<ParamListBase>, NavigationAction> = StackRouter({});
    const router = { ...original, ...localHistoryRouter(original) };
    const options = { routeNames: ["index", "current"], routeGetIdList: {} };
    let state: StackNavigationState<ParamListBase> = {
      stale: false,
      type: "stack",
      key: "native-stack",
      routeKeySeq: 1,
      routeNames: options.routeNames,
      index: 0,
      routes: [{ name: "index", key: "native-index" }],
    };
    for (const action of [StackActions.push("current"), StackActions.popTo("index")]) {
      const expected = original.getStateForAction(state, action, options);
      const result = router.getStateForAction(state, action, options);
      expect(result).toEqual(expected);
      if (!result || typeof result !== "object") throw new Error("Navigation was not handled");
      state = result.state;
    }
    expect(state.routes.map(route => route.key)).toEqual(["native-index"]);
  });

  it("reaches the application navigator below Expo Router's outer root", () => {
    const fixture = createHistoryFixture();
    writeLocalHistory(fixture.navigation, "pipes-index", {
      operation: "push", params: { pipeId: "feed" }, value: ["feed"],
    });
    expect(fixture.index).toBe(1);
    expect(fixture.state.routes[0].state?.routes[0].state?.routes[0].params).toEqual({ pipeId: "feed" });
  });
  it("records a nested selection without adding or remounting a screen", () => {
    const original: Router<StackNavigationState<ParamListBase>, NavigationAction> = StackRouter({});
    const router = { ...original, ...localHistoryRouter(original) };
    const pipes: StackNavigationState<ParamListBase> = {
      stale: false,
      type: "stack",
      key: "pipes",
      routeKeySeq: 1,
      routeNames: ["index"],
      index: 0,
      routes: [{ name: "index", key: "pipes-index" }],
    };
    const root: StackNavigationState<ParamListBase> = {
      ...pipes,
      key: "root",
      routeNames: ["main"],
      routes: [{ name: "main", key: "main", state: pipes }],
    };
    const result = router.getStateForAction(root, {
      type: "LOCAL_HISTORY",
      payload: { routeKey: "pipes-index", operation: "push", params: { pipeId: "feed" }, value: ["feed"] },
    }, { routeNames: root.routeNames, routeGetIdList: {} });
    if (!result || typeof result !== "object") throw new Error("History entry was not handled");
    expect(result.browserHistory).toEqual({ type: "push" });
    expect(result.state.routes[0].state?.routes[0]).toMatchObject({ key: "pipes-index", params: { pipeId: "feed" } });
    expect(result.state.routes).toHaveLength(1);
    expect(result.state.routes[0].state?.routes).toHaveLength(1);
  });
});
