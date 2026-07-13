import { describe, expect, it } from "bun:test";
import TestRenderer, { act } from "react-test-renderer";
import {
  ModalContext,
  useModal,
  useModalState,
  type ModalContextType,
} from "./ModalContext";

describe("useModalState", () => {
  it("starts with visible=false and content=null", () => {
    let state: ReturnType<typeof useModalState> | null = null;
    function Harness() {
      state = useModalState();
      return null;
    }
    act(() => { TestRenderer.create(<Harness />); });
    expect(state).not.toBeNull();
    expect(state!.visible).toBe(false);
    expect(state!.content).toBeNull();
  });

  it("open sets visible=true and stores content", () => {
    let state: ReturnType<typeof useModalState> | null = null;
    function Harness() {
      state = useModalState();
      return null;
    }
    act(() => { TestRenderer.create(<Harness />); });
    act(() => { state!.open("hello"); });
    expect(state!.visible).toBe(true);
    expect(state!.content).toBe("hello");
  });

  it("close sets visible=false", () => {
    let state: ReturnType<typeof useModalState> | null = null;
    function Harness() {
      state = useModalState();
      return null;
    }
    act(() => { TestRenderer.create(<Harness />); });
    act(() => { state!.open("hello"); });
    act(() => { state!.close(); });
    expect(state!.visible).toBe(false);
  });

  it("open replaces existing content", () => {
    let state: ReturnType<typeof useModalState> | null = null;
    function Harness() {
      state = useModalState();
      return null;
    }
    act(() => { TestRenderer.create(<Harness />); });
    act(() => { state!.open("first"); });
    act(() => { state!.open("second"); });
    expect(state!.content).toBe("second");
  });
});

describe("useModal", () => {
  it("returns open/close from provider", () => {
    let ctx: ModalContextType | null = null;
    function Harness() {
      ctx = useModal();
      return null;
    }
    const state = { open: () => {}, close: () => {} };
    act(() => {
      TestRenderer.create(
        <ModalContext.Provider value={state}>
          <Harness />
        </ModalContext.Provider>,
      );
    });
    expect(ctx).toBe(state);
  });
});
