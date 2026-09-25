// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRuleClock } from "./use-rule-clock";
const state = vi.hoisted(() => ({ focused: true }));
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => state.focused }));
afterEach(() => vi.useRealTimers());

it("updates countdowns once per minute only while a timed pipe list is focused", () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000000);
  state.focused = true;
  const { result, rerender, unmount } = renderHook(({ enabled }) => useRuleClock(enabled), { initialProps: { enabled: true } });
  act(() => vi.advanceTimersByTime(60000));
  expect(result.current).toBe(1060000);
  state.focused = false;
  rerender({ enabled: true });
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(60000));
  expect(result.current).toBe(1060000);
  state.focused = true;
  rerender({ enabled: false });
  expect(vi.getTimerCount()).toBe(0);
  unmount();
});
