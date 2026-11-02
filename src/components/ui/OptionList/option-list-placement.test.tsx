// @vitest-environment jsdom
import { createRef, type ComponentPropsWithRef, type RefObject } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { View, type LayoutChangeEvent, type ViewInstance } from "react-native";
import { AnchoredOptionList, OptionListHost, OverlaidOptionList } from ".";
import { useOptionListHost } from "./optionListHost.context";

const layout = vi.hoisted(() => ({ surface: undefined as ((event: LayoutChangeEvent) => void) | undefined }));
const runtime = vi.hoisted(() => ({ platform: "web" as "web" | "ios", keyboardTop: undefined as number | undefined }));

vi.mock("react-native", async importOriginal => {
  const actual = await importOriginal<typeof import("react-native")>();
  return {
    ...actual,
    Platform: { ...actual.Platform, get OS() { return runtime.platform; } },
    Keyboard: { ...actual.Keyboard, metrics: () => runtime.keyboardTop === undefined ? undefined : { screenY: runtime.keyboardTop } },
    useWindowDimensions: () => ({ width: 400, height: 800, scale: 1, fontScale: 1 }),
    View: (props: ComponentPropsWithRef<typeof actual.View>) => {
      if (props.testID === "collapsible-select-overlay") layout.surface = props.onLayout;
      return <actual.View {...props} />;
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  runtime.platform = "web"; runtime.keyboardTop = undefined;
});

it.each(["suggestions", "collapsible"] as const)("tracks %s after ancestor scroll, host reflow, and visual viewport changes", async kind => {
  const anchorRef = createRef<ViewInstance>();
  const boundsRef = createRef<ViewInstance>();
  let viewportRef: RefObject<ViewInstance | null> | undefined;
  let anchorY = 300;
  let modalBounds = { x: 20, y: 80, width: 360, height: 560 };
  const resizeCallbacks: ResizeObserverCallback[] = [];
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resizeCallbacks.push(callback); }
    observe() {}
    unobserve() {}
    disconnect = disconnect;
  });
  const visualViewport = Object.assign(new EventTarget(), { width: 400, height: 800, offsetTop: 0, offsetLeft: 0 });
  vi.stubGlobal("visualViewport", visualViewport);

  function Content({ open }: { open: boolean }) {
    viewportRef = useOptionListHost()?.viewportRef;
    return <>
      <View ref={anchorRef} />
      <View ref={boundsRef} />
      {open && (kind === "suggestions"
        ? <AnchoredOptionList visible anchorRef={anchorRef} maxHeight={160} onClose={() => {}}
            data={["Choice"]} renderItem={({ item }) => <View accessibilityLabel={item} />} />
        : <OverlaidOptionList anchorRef={anchorRef} onOutsidePress={() => {}} onRequestClose={() => true}>
            <View accessibilityLabel="Choice" />
          </OverlaidOptionList>)}
    </>;
  }
  function Fixture({ open }: { open: boolean }) {
    return <OptionListHost boundsRef={boundsRef}><Content open={open} /></OptionListHost>;
  }
  const { rerender } = render(<Fixture open={false} />);
  const measureAnchor = vi.spyOn(anchorRef.current!, "measureInWindow").mockImplementation(callback => callback(40, anchorY, 300, 40));
  vi.spyOn(viewportRef!.current!, "measureInWindow").mockImplementation(callback => callback(0, 0, 400, 800));
  vi.spyOn(boundsRef.current!, "measureInWindow").mockImplementation(callback => {
    const { x, y, width, height } = modalBounds;
    callback(x, y, width, height);
  });
  rerender(<Fixture open />);
  const surface = () => screen.getByTestId(kind === "suggestions" ? "anchored-option-list" : "collapsible-select-overlay");
  const bottom = () => parseFloat(surface().style.top) + Math.min(kind === "collapsible" ? 100 : Infinity, parseFloat(surface().style.maxHeight));
  if (kind === "collapsible") act(() => layout.surface?.({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 100 } } } as LayoutChangeEvent));
  await waitFor(() => expect(surface().style.top).toBe(kind === "suggestions" ? "344px" : "300px"));

  anchorY = 200;
  fireEvent.scroll(document);
  await waitFor(() => expect(surface().style.top).toBe(kind === "suggestions" ? "244px" : "200px"));

  // The modal can shrink without a window-size change, e.g. when its accessory grows.
  modalBounds = { x: 80, y: 120, width: 240, height: 180 };
  act(() => resizeCallbacks.forEach(callback => callback([], {} as ResizeObserver)));
  await waitFor(() => {
    expect(parseFloat(surface().style.left)).toBeGreaterThanOrEqual(96);
    expect(bottom()).toBeLessThanOrEqual(284);
  });

  // Mobile browsers may change only their visual viewport when the keyboard opens.
  visualViewport.height = 250;
  act(() => visualViewport.dispatchEvent(new Event("resize")));
  await waitFor(() => expect(bottom()).toBeLessThanOrEqual(234));

  rerender(<Fixture open={false} />);
  const callsAfterClose = measureAnchor.mock.calls.length;
  fireEvent.scroll(document);
  act(() => visualViewport.dispatchEvent(new Event("resize")));
  expect(measureAnchor).toHaveBeenCalledTimes(callsAfterClose);
  expect(disconnect).toHaveBeenCalled();
});

it.each(["suggestions", "collapsible"] as const)("tracks native ancestor movement for %s with an already-open keyboard, only while open", async kind => {
  runtime.platform = "ios";
  runtime.keyboardTop = 360;
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const anchorRef = createRef<ViewInstance>();
  let viewportRef: RefObject<ViewInstance | null> | undefined;
  let anchorY = 300;
  function Content({ open }: { open: boolean }) {
    viewportRef = useOptionListHost()?.viewportRef;
    return <>
      <View ref={anchorRef} />
      {open && (kind === "suggestions"
        ? <AnchoredOptionList visible anchorRef={anchorRef} maxHeight={160} onClose={() => {}}
            data={["Choice"]} renderItem={({ item }) => <View accessibilityLabel={item} />} />
        : <OverlaidOptionList anchorRef={anchorRef} onOutsidePress={() => {}} onRequestClose={() => true}>
            <View accessibilityLabel="Choice" />
          </OverlaidOptionList>)}
    </>;
  }
  function Fixture({ open }: { open: boolean }) {
    return <OptionListHost><Content open={open} /></OptionListHost>;
  }
  const { rerender } = render(<Fixture open={false} />);
  vi.spyOn(anchorRef.current!, "measureInWindow").mockImplementation(callback => callback(40, anchorY, 300, 40));
  vi.spyOn(viewportRef!.current!, "measureInWindow").mockImplementation(callback => callback(0, 0, 400, 800));
  rerender(<Fixture open />);
  const surface = () => screen.getByTestId(kind === "suggestions" ? "anchored-option-list" : "collapsible-select-overlay");
  if (kind === "collapsible") act(() => layout.surface?.({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 100 } } } as LayoutChangeEvent));
  await waitFor(() => expect(surface().style.top).toBe(kind === "suggestions" ? "136px" : "236px"));
  anchorY = 200;
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(16));
  });
  expect(surface().style.top).toBe(kind === "suggestions" ? "36px" : "200px");
  expect(frames.size).toBeGreaterThan(0);
  rerender(<Fixture open={false} />);
  expect(frames.size).toBe(0);
});
