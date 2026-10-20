// @vitest-environment jsdom
import type { KeyboardEvent, LayoutChangeEvent, View as NativeView } from "react-native";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalShell } from "./ModalShell";

// Model native screen/window metrics separately: Android may resize the window for the keyboard.
const native = vi.hoisted(() => ({
  screenHeight: 1000,
  windowHeight: 1000,
  windowWidth: 400,
  keyboardTop: undefined as number | undefined,
  platform: "ios" as "ios" | "android" | "web",
  listeners: new Map<string, (event: KeyboardEvent) => void>(),
  measureViewport: undefined as (() => void) | undefined,
  completeMeasurement: undefined as ((top: number) => void) | undefined,
}));

vi.mock("react-native", async importOriginal => {
  const actual = await importOriginal<typeof import("react-native")>();
  const React = await import("react");
  return {
    ...actual,
    View: ({ ref, ...props }: React.ComponentPropsWithRef<typeof actual.View>) => {
      React.useImperativeHandle(ref, () => ({
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => {
          native.completeMeasurement = top => callback(0, top, native.windowWidth, native.windowHeight);
        },
      }) as NativeView);
      if (ref && props.onLayout) {
        native.measureViewport = () => props.onLayout?.({
          nativeEvent: { layout: { x: 0, y: 0, width: native.windowWidth, height: native.windowHeight } },
        } as LayoutChangeEvent);
      }
      return <actual.View {...props} />;
    },
    Platform: { ...actual.Platform, get OS() { return native.platform; } },
    Dimensions: {
      ...actual.Dimensions,
      get: () => ({ height: native.screenHeight, width: native.windowWidth, scale: 1, fontScale: 1 }),
    },
    useWindowDimensions: () => ({ height: native.windowHeight, width: native.windowWidth, scale: 1, fontScale: 1 }),
    Keyboard: {
      ...actual.Keyboard,
      metrics: () => native.keyboardTop === undefined ? undefined : { screenY: native.keyboardTop },
      addListener: (name: string, listener: (event: KeyboardEvent) => void) => {
        native.listeners.set(name, listener);
        return { remove: () => native.listeners.delete(name) };
      },
    },
  };
});

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 20, bottom: 10, left: 0, right: 0 }),
}));

function bounds() {
  const region = screen.getByTestId("modal-content-region");
  return { top: Number.parseFloat(region.style.top), height: Number.parseFloat(region.style.height) };
}

function keyboardEvent(screenY: number): KeyboardEvent {
  return {
    duration: 250,
    easing: "keyboard",
    endCoordinates: { screenY, screenX: 0, width: 400, height: 1000 - screenY },
  };
}

function keyboardFrame(screenY: number) {
  act(() => native.listeners.get(native.platform === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow")?.(keyboardEvent(screenY)));
}

beforeEach(() => {
  native.screenHeight = 1000;
  native.windowHeight = 1000;
  native.windowWidth = 400;
  native.keyboardTop = undefined;
  native.listeners.clear();
  native.measureViewport = undefined;
  native.completeMeasurement = undefined;
});

afterEach(() => vi.restoreAllMocks());

describe.each(["ios", "android"] as const)("ModalShell keyboard placement (%s)", platform => {
  beforeEach(() => { native.platform = platform; });

  it("bounds growth between 10% and 80% of the viewport and moves above the keyboard", () => {
    const content = <ModalShell visible onClose={() => {}}><div>Content</div></ModalShell>;
    const { rerender } = render(content);
    const initial = bounds();
    expect(initial.top).toBe(100);
    expect(initial.top + initial.height).toBe(800);
    expect(screen.getByTestId("modal-content-region").style.justifyContent).toBe("flex-end");
    keyboardFrame(700);
    expect(bounds().top + bounds().height).toBe(676);
    native.windowHeight = 700;
    rerender(<ModalShell visible onClose={() => {}}><div>More content</div></ModalShell>);
    expect(bounds()).toEqual({ top: 100, height: 566 });
    expect(screen.getByText("More content")).toBeTruthy();
  });

  it("moves above the keyboard, restores the bottom anchor on hide, and adapts to rotation", () => {
    const renderModal = () => <ModalShell visible onClose={() => {}}><div>Content</div></ModalShell>;
    const { rerender, unmount } = render(renderModal());
    keyboardFrame(500);
    expect(bounds()).toEqual({ top: 100, height: 376 });
    act(() => native.listeners.get(platform === "ios" ? "keyboardWillHide" : "keyboardDidHide")?.(keyboardEvent(1000)));
    expect(bounds()).toEqual({ top: 100, height: 700 });
    native.screenHeight = 600;
    native.windowHeight = 600;
    native.windowWidth = 1000;
    rerender(renderModal());
    expect(bounds()).toEqual({ top: 60, height: 420 });
    unmount();
    expect(native.listeners.size).toBe(0);
  });

  it("respects a keyboard that is already open when a modal mounts", () => {
    native.keyboardTop = 500;
    render(<ModalShell visible onClose={() => {}}><div>Content</div></ModalShell>);
    expect(bounds()).toEqual({ top: 100, height: 376 });
  });

  it("converts screen keyboard coordinates after a delayed viewport-origin measurement", () => {
    render(<ModalShell visible onClose={() => {}}><div>Content</div></ModalShell>);
    act(() => native.measureViewport?.());
    keyboardFrame(500);
    act(() => native.completeMeasurement?.(20));
    const region = bounds();
    expect(region.top).toBe(80);
    expect(20 + region.top + region.height).toBe(476);
  });
});

it("stays inside the browser viewport rather than reserving part of the monitor height", () => {
  native.platform = "web";
  native.screenHeight = 2000;
  const layoutHeight = vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(1000);
  const renderModal = () => <ModalShell visible onClose={() => {}}><div>Content</div></ModalShell>;
  const { rerender } = render(renderModal());
  expect(bounds()).toEqual({ top: 100, height: 700 });
  native.windowHeight = 700;
  rerender(renderModal());
  expect(bounds()).toEqual({ top: 100, height: 566 });
  native.windowHeight = 450;
  rerender(renderModal());
  expect(bounds().top + bounds().height).toBeLessThan(450);
  layoutHeight.mockReturnValue(600);
  native.windowHeight = 600;
  native.windowWidth = 1000;
  rerender(renderModal());
  expect(bounds()).toEqual({ top: 60, height: 420 });
});
