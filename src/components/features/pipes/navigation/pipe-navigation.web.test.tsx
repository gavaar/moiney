// @vitest-environment jsdom
import { useEffect, useLayoutEffect, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StackActions } from "expo-router/build/react-navigation/routers/StackRouter";
import { createHistoryFixture } from "@/lib/navigation/local-history.test-fixture";
import { getPipesHref, usePipeNavigation } from "./pipe-navigation.web";
import { focusedRoute } from "@/lib/navigation/local-history";
import type { PipeModel } from "../data/pipes";

const boundary = vi.hoisted(() => ({ fixture: undefined as ReturnType<typeof createHistoryFixture> | undefined }));
vi.mock("expo-router", () => ({
  useNavigationContainerRef: () => boundary.fixture!.navigation,
  useRootNavigationState: () => boundary.fixture!.state,
}));

const feed = "feed" as PipeModel["id"];
const parent = "parent" as PipeModel["id"];
const child = "child" as PipeModel["id"];
const other = "other" as PipeModel["id"];

function Selection() {
  const { selectedPipePath, selectPipe, deselectPipe, reconcilePipe } = usePipeNavigation();
  return <>
    <output aria-label="Selection">{selectedPipePath.join("/") || "Feeds"}</output>
    <button onClick={() => selectPipe([feed, parent, child])}>Open deep pipe</button>
    <button onClick={() => selectPipe([feed])}>Feed breadcrumb</button>
    <button onClick={deselectPipe}>Clear selection</button>
    <button onClick={() => reconcilePipe([feed])}>Child deleted</button>
    <button onClick={() => {
      const stalePath = selectedPipePath;
      selectPipe([feed, other]);
      reconcilePipe(current => current === stalePath ? [feed] : current);
    }}>Open another pipe while the old child disappears</button>
  </>;
}

function Fixture() {
  const fixture = boundary.fixture!;
  const [state, setState] = useState(fixture.state);
  useLayoutEffect(() => {
    fixture.setRender(() => setState(fixture.state));
    return () => fixture.setRender(() => {});
  }, [fixture]);
  useEffect(() => { fixture.emit(state); }, [fixture, state]);
  return <Selection />;
}

describe("web pipe navigation", () => {
  beforeEach(() => { boundary.fixture = createHistoryFixture(); });

  it("records all ancestors for a direct jump and lets Back reach the feed list before leaving", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("Open deep pipe"));
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/parent/child");
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/parent");
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("feed");
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("Feeds");
    act(() => boundary.fixture!.back());
    expect(boundary.fixture!.fallthroughs).toBe(1);
  });

  it("trims ancestry for breadcrumbs instead of returning to the child", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("Open deep pipe"));
    fireEvent.click(screen.getByText("Feed breadcrumb"));
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("Feeds");
    act(() => boundary.fixture!.forward());
    expect(screen.getByLabelText("Selection").textContent).toBe("feed");
  });

  it.each(["Clear selection", "Child deleted"])("does not retain obsolete Back stops after %s", action => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("Open deep pipe"));
    fireEvent.click(screen.getByText(action));
    if (action === "Child deleted") {
      expect(screen.getByLabelText("Selection").textContent).toBe("feed");
      act(() => boundary.fixture!.back());
    }
    expect(screen.getByLabelText("Selection").textContent).toBe("Feeds");
    act(() => boundary.fixture!.back());
    expect(boundary.fixture!.fallthroughs).toBe(1);
  });

  it("preserves selection off screen and restores a historical Pipes visit without seeding again", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("Open deep pipe"));
    act(() => boundary.fixture!.navigation.dispatch(StackActions.push("history")));
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/parent/child");
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/parent/child");
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/parent");
  });

  it("returns from an inactive report without needing to merge its old route params", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("Open deep pipe"));
    act(() => boundary.fixture!.navigation.dispatch(StackActions.push("current")));
    act(() => boundary.fixture!.navigation.dispatch(StackActions.push("history")));
    const href = getPipesHref([feed, parent, child]);
    if (typeof href !== "object") throw new Error("Expected a selected-pipe destination");

    // The Pipes shortcut returns the inactive stack to its index, then
    // navigates with the selected pipe's destination params.
    act(() => {
      const navigation = boundary.fixture!.navigation;
      navigation.dispatch({ ...StackActions.popTo("index"), target: "pipes-stack" });
      navigation.dispatch({ type: "NAVIGATE", target: "pipes-stack", payload: { name: "index", params: href.params } });
    });

    expect(screen.getByLabelText("Selection").textContent).toBe("feed/parent/child");
    expect(focusedRoute(boundary.fixture!.state)).toMatchObject({ name: "index", key: "pipes-index", params: { pipeId: child } });
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/parent");
  });

  it("seeds a queued selection only once", async () => {
    const navigation = boundary.fixture!.navigation;
    const dispatch = navigation.dispatch;
    vi.spyOn(navigation, "dispatch").mockImplementation(action => { queueMicrotask(() => dispatch(action)); });
    render(<Fixture />);
    await act(async () => { fireEvent.click(screen.getByText("Open deep pipe")); });
    expect(boundary.fixture!.index).toBe(3);
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/parent/child");
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/parent");
  });

  it("does not let stale deletion reconciliation overwrite a queued pipe opening", async () => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("Open deep pipe"));
    const navigation = boundary.fixture!.navigation;
    const dispatch = navigation.dispatch;
    vi.spyOn(navigation, "dispatch").mockImplementation(action => { queueMicrotask(() => dispatch(action)); });
    await act(async () => {
      fireEvent.click(screen.getByText("Open another pipe while the old child disappears"));
    });
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/other");
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("feed");
  });
});
