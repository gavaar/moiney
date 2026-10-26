// @vitest-environment jsdom
import { createRef, type ComponentPropsWithRef, type RefObject } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { View, type LayoutChangeEvent, type ViewInstance } from "react-native";
import { OptionListHost } from "../OptionListHost/OptionListHost";
import { useOptionListHost } from "../../optionListHost.context";
import { OverlaidOptionList } from "./OverlaidOptionList";

const layout = vi.hoisted(() => ({
  surface: undefined as ((event: LayoutChangeEvent) => void) | undefined,
}));

vi.mock("react-native", async importOriginal => {
  const actual = await importOriginal<typeof import("react-native")>();
  return {
    ...actual,
    useWindowDimensions: () => ({ width: 400, height: 800, scale: 1, fontScale: 1 }),
    View: (props: ComponentPropsWithRef<typeof actual.View>) => {
      if (props.testID === "collapsible-select-overlay") layout.surface = props.onLayout;
      return <actual.View {...props} />;
    },
  };
});

afterEach(() => vi.restoreAllMocks());

it.each([false, true])("never shows a temporary top position while opening measurements arrive (content first=%s)", contentFirst => {
  const anchorRef = createRef<ViewInstance>();
  const boundsRef = createRef<ViewInstance>();
  let viewportRef: RefObject<ViewInstance | null> | undefined;
  let measureAnchor: Parameters<ViewInstance["measureInWindow"]>[0] | undefined;
  let measureViewport: typeof measureAnchor;
  let measureBounds: typeof measureAnchor;
  function Fixture({ open }: { open: boolean }) {
    return <OptionListHost boundsRef={boundsRef}><Content open={open} /></OptionListHost>;
  }
  function Content({ open }: { open: boolean }) {
    viewportRef = useOptionListHost()?.viewportRef;
    return <>
      <View ref={anchorRef} />
      <View ref={boundsRef} />
      {open && <OverlaidOptionList anchorRef={anchorRef} onOutsidePress={() => {}} onRequestClose={() => true}>
        <View accessibilityLabel="Options" />
      </OverlaidOptionList>}
    </>;
  }
  const { rerender } = render(<Fixture open={false} />);
  vi.spyOn(anchorRef.current!, "measureInWindow").mockImplementation(callback => { measureAnchor = callback; });
  vi.spyOn(viewportRef!.current!, "measureInWindow").mockImplementation(callback => { measureViewport = callback; });
  vi.spyOn(boundsRef.current!, "measureInWindow").mockImplementation(callback => { measureBounds = callback; });
  rerender(<Fixture open />);

  const visibleTops: string[] = [];
  function recordVisiblePosition() {
    const surface = screen.queryByTestId("collapsible-select-overlay");
    if (surface && getComputedStyle(surface).opacity !== "0" && getComputedStyle(surface).visibility !== "hidden") {
      visibleTops.push(surface.style.top);
    }
  }
  recordVisiblePosition();
  if (contentFirst) {
    act(() => layout.surface?.({ nativeEvent: { layout: { x: 0, y: 0, width: 368, height: 120 } } } as LayoutChangeEvent));
    recordVisiblePosition();
  }
  act(() => measureAnchor?.(40, 500, 320, 70));
  recordVisiblePosition();
  act(() => measureViewport?.(0, 0, 400, 800));
  recordVisiblePosition();
  act(() => measureBounds?.(0, 80, 400, 560));
  recordVisiblePosition();
  act(() => layout.surface?.({ nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 200 } } } as LayoutChangeEvent));
  recordVisiblePosition();
  expect(visibleTops.length).toBeGreaterThan(0);
  expect(new Set(visibleTops)).toEqual(new Set(["424px"]));
});
