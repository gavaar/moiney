// @vitest-environment jsdom
import { createRef } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Dimensions, Keyboard, View, type ViewInstance } from "react-native";
import { AnchoredOptionList } from "./AnchoredOptionList";
import { OptionListHost } from "../components/OptionListHost/OptionListHost";

const suggestions = ["Last suggestion"];
const listProps = {
  data: suggestions,
  keyExtractor: (item: string) => item,
  renderItem: ({ item }: { item: string }) => <View accessibilityLabel={item} />,
  maxHeight: 160,
};

afterEach(() => vi.restoreAllMocks());

it("renders non-modal content outside a clipping ancestor in the current window", async () => {
  const anchorRef = createRef<ViewInstance>();
  render(
    <OptionListHost>
      <View testID="clipped-form" style={{ overflow: "hidden", height: 40 }}>
        <View ref={anchorRef} />
        <AnchoredOptionList {...listProps} visible anchorRef={anchorRef} onClose={() => {}} />
      </View>
    </OptionListHost>,
  );

  await waitFor(() => expect(screen.getByTestId("anchored-option-list")).toBeTruthy());
  expect(screen.getByTestId("clipped-form").contains(screen.getByTestId("anchored-option-list"))).toBe(false);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByLabelText("Last suggestion")).toBeTruthy();
  fireEvent.click(screen.getByTestId("anchored-option-list"));
});

it("remeasures placement when the keyboard appears and releases its listeners on close", async () => {
  vi.spyOn(Dimensions, "get").mockReturnValue({ width: 400, height: 800, scale: 1, fontScale: 1 });
  let showKeyboard: Parameters<typeof Keyboard.addListener>[1] | undefined;
  const remove = vi.fn();
  const addListener = Keyboard.addListener.bind(Keyboard);
  vi.spyOn(Keyboard, "addListener").mockImplementation((name, listener) => {
    if (name === "keyboardDidShow") showKeyboard = listener;
    const subscription = addListener(name, listener);
    vi.spyOn(subscription, "remove").mockImplementation(remove);
    return subscription;
  });
  const anchorRef = createRef<ViewInstance>();
  function Fixture({ visible }: { visible: boolean }) {
    return <OptionListHost>
      <View ref={anchorRef} />
      <AnchoredOptionList {...listProps} visible={visible} anchorRef={anchorRef} onClose={() => {}} />
    </OptionListHost>;
  }
  const { rerender } = render(<Fixture visible={false} />);
  vi.spyOn(anchorRef.current!, "measureInWindow").mockImplementation(callback => callback(20, 300, 240, 40));
  rerender(<Fixture visible />);
  await waitFor(() => expect(screen.getByTestId("anchored-option-list").style.top).toBe("344px"));
  expect(screen.getByTestId("anchored-option-list").style.width).toBe("240px");
  act(() => showKeyboard?.({
    duration: 0,
    easing: "keyboard",
    startCoordinates: { screenX: 0, screenY: 800, width: 400, height: 0 },
    endCoordinates: { screenX: 0, screenY: 360, width: 400, height: 440 },
  }));
  await waitFor(() => expect(screen.getByTestId("anchored-option-list").style.top).toBe("136px"));
  rerender(<Fixture visible={false} />);
  expect(remove).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId("anchored-option-list")).toBeNull();
});

it("uses the nearest native-window host and removes floating content when its owner unmounts", async () => {
  const anchorRef = createRef<ViewInstance>();
  function Fixture({ visible }: { visible: boolean }) {
    return <OptionListHost>
      <View testID="modal-window">
        <OptionListHost>
          <View ref={anchorRef} />
          {visible && <AnchoredOptionList {...listProps} visible anchorRef={anchorRef} onClose={() => {}} />}
        </OptionListHost>
      </View>
    </OptionListHost>;
  }
  const { rerender } = render(<Fixture visible />);
  await waitFor(() => expect(within(screen.getByTestId("modal-window")).getByLabelText("Last suggestion")).toBeTruthy());
  rerender(<Fixture visible={false} />);
  expect(screen.queryByLabelText("Last suggestion")).toBeNull();
});
