// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Animated, PanResponder, Text } from "react-native";
import { SwipeActions } from "./SwipeActions";

const left = () => ({
  accessibilityLabel: "Delete item",
  content: <Text>Trash</Text>,
  backgroundClassName: "bg-error",
  onActivate: vi.fn(),
});

const right = () => ({
  accessibilityLabel: "Edit item",
  content: <Text>Pencil</Text>,
  backgroundClassName: "bg-secondary",
  onActivate: vi.fn(),
});

function captureGestures() {
  const original = PanResponder.create;
  const spy = vi.spyOn(PanResponder, "create").mockImplementation((config) => original(config));
  return () => {
    const config = spy.mock.calls.at(-1)?.[0];
    if (!config) throw new Error("SwipeActions did not register gestures");
    const gesture = (dx: number, dy = 0) => ({ dx, dy }) as Parameters<NonNullable<typeof config.onPanResponderRelease>>[1];
    const move = (dx: number, dy = 0) => config.onMoveShouldSetPanResponder?.({} as never, gesture(dx, dy));
    const drag = (dx: number) => config.onPanResponderMove?.({} as never, gesture(dx));
    const release = (dx: number) => config.onPanResponderRelease?.({} as never, gesture(dx));
    return { move, drag, release };
  };
}

afterEach(() => vi.restoreAllMocks());

describe("SwipeActions", () => {
  it("activates the left action on a right swipe and the right action on a left swipe", () => {
    const getGestures = captureGestures();
    const leftAction = left();
    const rightAction = right();
    render(<SwipeActions leftAction={leftAction} rightAction={rightAction}><Text>Item</Text></SwipeActions>);
    const gestures = getGestures();

    expect(gestures.move(45)).toBe(true);
    act(() => gestures.release(45));
    expect(leftAction.onActivate).toHaveBeenCalledOnce();
    expect(rightAction.onActivate).not.toHaveBeenCalled();

    expect(gestures.move(-45)).toBe(true);
    act(() => gestures.release(-45));
    expect(rightAction.onActivate).toHaveBeenCalledOnce();
    expect(leftAction.onActivate).toHaveBeenCalledOnce();
  });

  it("leaves vertical gestures to the list and ignores swipes below the threshold", () => {
    const getGestures = captureGestures();
    const leftAction = left();
    const rightAction = right();
    render(<SwipeActions leftAction={leftAction} rightAction={rightAction}><Text>Item</Text></SwipeActions>);
    const gestures = getGestures();

    expect(gestures.move(50, 70)).toBe(false);
    expect(gestures.move(8)).toBe(false);
    expect(gestures.move(-8)).toBe(false);
    act(() => {
      gestures.release(39);
      gestures.release(-39);
    });
    expect(leftAction.onActivate).not.toHaveBeenCalled();
    expect(rightAction.onActivate).not.toHaveBeenCalled();
  });

  it("clamps each direction to 72 while retaining an underlay wider than the reveal", () => {
    const getGestures = captureGestures();
    const setValue = vi.spyOn(Animated.Value.prototype, "setValue");
    render(<SwipeActions leftAction={left()} rightAction={right()}><Text>Item</Text></SwipeActions>);
    const gestures = getGestures();

    gestures.drag(120);
    expect(setValue).toHaveBeenLastCalledWith(72);
    gestures.drag(-120);
    expect(setValue).toHaveBeenLastCalledWith(-72);
    expect(screen.getByRole("button", { name: "Delete item" }).style.width).toBe("92px");
    expect(screen.getByRole("button", { name: "Edit item" }).style.width).toBe("92px");
  });

  it("honors disabled actions for gestures and accessible presses", () => {
    const getGestures = captureGestures();
    const leftAction = { ...left(), disabled: true };
    render(<SwipeActions leftAction={leftAction}><Text>Item</Text></SwipeActions>);
    const gestures = getGestures();

    expect(gestures.move(45)).toBe(false);
    expect(gestures.move(-45)).toBe(false);
    act(() => gestures.release(45));
    const button = screen.getByRole("button", { name: "Delete item" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    expect(leftAction.onActivate).not.toHaveBeenCalled();
  });
});
