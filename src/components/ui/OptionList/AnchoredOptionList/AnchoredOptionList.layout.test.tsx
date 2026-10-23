// @vitest-environment jsdom
import { createRef, type ComponentPropsWithRef } from "react";
import type { FlatListProps, LayoutChangeEvent, View } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AnchoredOptionList, OptionListHost } from "..";

const layout = vi.hoisted(() => ({
  surface: undefined as ((event: LayoutChangeEvent) => void) | undefined,
  list: undefined as ((event: LayoutChangeEvent) => void) | undefined,
  content: undefined as ((width: number, height: number) => void) | undefined,
}));

vi.mock("react-native", async importOriginal => {
  const actual = await importOriginal<typeof import("react-native")>();
  return {
    ...actual,
    useWindowDimensions: () => ({ width: 400, height: 800, scale: 1, fontScale: 1 }),
    Keyboard: { ...actual.Keyboard, metrics: () => ({ screenY: 360 }) },
    View: (props: ComponentPropsWithRef<typeof actual.View>) => {
      if (props.testID === "anchored-option-list") layout.surface = props.onLayout;
      return <actual.View {...props} />;
    },
    FlatList: (props: FlatListProps<unknown>) => {
      layout.list = props.onLayout;
      layout.content = props.onContentSizeChange;
      return <actual.FlatList {...props} />;
    },
  };
});

afterEach(() => vi.restoreAllMocks());

it.each([
  { contentHeight: 100, surfaceHeight: 124, listHeight: 100, top: "172px" },
  { contentHeight: 300, surfaceHeight: 160, listHeight: 136, top: "136px" },
])("positions natural content ($contentHeight) plus measured padding above the anchor", async ({ contentHeight, surfaceHeight, listHeight, top }) => {
  const anchorRef = createRef<View>();
  const { View } = await import("react-native");
  function Fixture({ visible }: { visible: boolean }) {
    return <OptionListHost>
      <View ref={anchorRef} />
      <AnchoredOptionList
        visible={visible}
        onClose={() => {}}
        anchorRef={anchorRef}
        maxHeight={160}
        className="p-3"
        data={["Suggestion"]}
        keyExtractor={item => item}
        renderItem={({ item }) => <View accessibilityLabel={item} />}
      />
    </OptionListHost>;
  }
  const { rerender } = render(<Fixture visible={false} />);
  vi.spyOn(anchorRef.current!, "measureInWindow").mockImplementation(callback => callback(20, 300, 240, 40));
  rerender(<Fixture visible />);

  const event = (height: number): LayoutChangeEvent => ({
    nativeEvent: { layout: { x: 0, y: 0, width: 240, height } },
  }) as LayoutChangeEvent;
  act(() => {
    layout.content?.(240, contentHeight);
    layout.surface?.(event(surfaceHeight));
    layout.list?.(event(listHeight));
  });
  await waitFor(() => expect(screen.getByTestId("anchored-option-list").style.top).toBe(top));
});
