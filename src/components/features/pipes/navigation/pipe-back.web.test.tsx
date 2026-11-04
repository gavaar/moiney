// @vitest-environment jsdom
import { useEffect, useLayoutEffect, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHistoryFixture } from "@/lib/navigation/local-history.test-fixture";
import { usePipeNavigation } from "@features/pipes/navigation/pipe-navigation.web";
import { ConfirmModalProvider } from "@ui/ConfirmModal";
import { useFormDismissal } from "@ui/Form/use-form-dismissal";
import { ModalShell } from "@ui/Modal/ModalShell";
import { Popover } from "@ui/Popover/Popover";
import type { PipeModel } from "@features/pipes/data/pipes";

const boundary = vi.hoisted(() => ({ fixture: undefined as ReturnType<typeof createHistoryFixture> | undefined }));
vi.mock("expo-router", () => ({
  useNavigationContainerRef: () => boundary.fixture!.navigation,
  useRootNavigationState: () => boundary.fixture!.state,
}));
// Select the web adapter explicitly: the repository's general component suite
// resolves .ts by default, while Metro selects .web.ts in the actual web app.
vi.mock("@ui/Modal/use-modal-back", () => import("@ui/Modal/use-modal-back.web"));

const feed = "feed" as PipeModel["id"];
const child = "child" as PipeModel["id"];

function Editor() {
  const { selectedPipePath, selectPipe } = usePipeNavigation();
  const [editing, setEditing] = useState(false);
  const [nested, setNested] = useState(false);
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const { requestClose, onDismissStateChange } = useFormDismissal(() => setEditing(false));
  useLayoutEffect(() => { onDismissStateChange(draft !== "", saving); }, [draft, onDismissStateChange, saving]);
  return <>
    <output aria-label="Selection">{selectedPipePath.join("/") || "Feeds"}</output>
    <button onClick={() => selectPipe([feed, child])}>Select child</button>
    <button onClick={() => setEditing(true)}>Open editor</button>
    <ModalShell visible={editing} onClose={requestClose}>
      <input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} />
      <button onClick={() => setNested(true)}>Open nested modal</button>
      <button onClick={() => setMenu(true)}>Open menu</button>
      <button onClick={() => setSaving(true)}>Start saving</button>
      <button onClick={() => setEditing(false)}>Submit successfully</button>
      <ModalShell visible={nested} onClose={() => setNested(false)}><div>Nested modal</div></ModalShell>
      <Popover visible={menu} onClose={() => setMenu(false)} anchorRef={{ current: null }}><div>Editor menu</div></Popover>
    </ModalShell>
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
  return <ConfirmModalProvider><Editor /></ConfirmModalProvider>;
}

describe("web Back priority", () => {
  beforeEach(() => { boundary.fixture = createHistoryFixture(); });

  it("dismisses stacked modals before stepping through pipes, then allows normal Back", async () => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("Select child"));
    fireEvent.click(screen.getByText("Open editor"));
    fireEvent.click(screen.getByText("Open nested modal"));
    act(() => boundary.fixture!.back());
    await waitFor(() => expect(screen.queryByText("Nested modal")).toBeNull());
    expect(screen.getByLabelText("Draft")).toBeDefined();
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/child");
    act(() => boundary.fixture!.back());
    await waitFor(() => expect(screen.queryByLabelText("Draft")).toBeNull());
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/child");
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("feed");
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("Feeds");
    act(() => boundary.fixture!.back());
    expect(boundary.fixture!.fallthroughs).toBe(1);
  });

  it("dismisses a popover before its editor", async () => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("Open editor"));
    fireEvent.click(screen.getByText("Open menu"));
    act(() => boundary.fixture!.back());
    let node: HTMLElement | null = screen.getByText("Editor menu");
    while (node) {
      fireEvent.animationEnd(node);
      fireEvent(node, new Event("webkitAnimationEnd", { bubbles: true }));
      node = node.parentElement;
    }
    await waitFor(() => expect(screen.queryByText("Editor menu")).toBeNull());
    expect(screen.getByLabelText("Draft")).toBeDefined();
    act(() => boundary.fixture!.back());
    await waitFor(() => expect(screen.queryByLabelText("Draft")).toBeNull());
    act(() => boundary.fixture!.back());
    expect(boundary.fixture!.fallthroughs).toBe(1);
  });

  it("protects dirty drafts, cancels confirmation on Back, and consumes Back while saving", async () => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("Select child"));
    fireEvent.click(screen.getByText("Open editor"));
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "Keep this draft" } });
    act(() => boundary.fixture!.back());
    expect(await screen.findByText("Discard changes?")).toBeDefined();
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/child");
    act(() => boundary.fixture!.back());
    await waitFor(() => expect(screen.queryByText("Discard changes?")).toBeNull());
    expect(screen.getByLabelText("Draft")).toHaveProperty("value", "Keep this draft");
    fireEvent.click(screen.getByText("Start saving"));
    act(() => boundary.fixture!.back());
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Draft")).toHaveProperty("value", "Keep this draft");
    expect(screen.getByLabelText("Selection").textContent).toBe("feed/child");
  });

  it("removes its Back stop when submission closes the editor", async () => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("Select child"));
    fireEvent.click(screen.getByText("Open editor"));
    fireEvent.click(screen.getByText("Submit successfully"));
    await waitFor(() => expect(screen.queryByLabelText("Draft")).toBeNull());
    act(() => boundary.fixture!.back());
    expect(screen.getByLabelText("Selection").textContent).toBe("feed");
  });

  it("handles queued navigation and pending cleanup without treating registration as Back", async () => {
    const navigation = boundary.fixture!.navigation;
    const dispatch = navigation.dispatch;
    vi.spyOn(navigation, "dispatch").mockImplementation(action => { queueMicrotask(() => dispatch(action)); });
    render(<Fixture />);
    fireEvent.click(screen.getByText("Open editor"));
    await waitFor(() => expect(boundary.fixture!.index).toBe(1));
    expect(screen.getByLabelText("Draft")).toBeDefined();
    fireEvent.click(screen.getByText("Submit successfully"));
    await waitFor(() => expect(boundary.fixture!.index).toBe(0));
    expect(screen.getByLabelText("Selection").textContent).toBe("Feeds");
    act(() => boundary.fixture!.back());
    expect(boundary.fixture!.fallthroughs).toBe(1);
  });
});
