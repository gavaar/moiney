// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MonthlyCardPreferenceProvider, useMonthlyCardPreference } from "./MonthlyCardPreference";

const mocks = vi.hoisted(() => ({ accountKey: "deployment:alice" as string | null, read: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ accountKey: mocks.accountKey }) }));
vi.mock("./storage", () => ({ monthlyCardStorage: mocks }));

function Consumer() {
  const { ready, showInMain, setShowInMain } = useMonthlyCardPreference();
  return <button disabled={!ready} onClick={() => setShowInMain(!showInMain)}>{ready ? String(showInMain) : "loading"}</button>;
}
const view = () => <MonthlyCardPreferenceProvider><Consumer /><Consumer /></MonthlyCardPreferenceProvider>;

beforeEach(() => {
  mocks.accountKey = "deployment:alice";
  mocks.read.mockReset().mockResolvedValue(null);
  mocks.write.mockReset().mockResolvedValue(undefined);
});

it.each([null, "invalid", "{}", "1", "true"])("defaults to enabled for missing or invalid storage (%s), without writing during hydration", async (raw) => {
  mocks.read.mockResolvedValue(raw);
  render(view());
  await waitFor(() => expect(screen.getAllByText("true")).toHaveLength(2));
  expect(mocks.write).not.toHaveBeenCalled();
});

it("shares updates immediately and restores a saved disabled preference after remount", async () => {
  mocks.write.mockImplementation(async (_key: string, value: string) => { mocks.read.mockResolvedValue(value); });
  const first = render(view());
  await waitFor(() => expect(screen.getAllByText("true")).toHaveLength(2));
  fireEvent.click(screen.getAllByRole("button")[0]);
  expect(screen.getAllByText("false")).toHaveLength(2);
  await waitFor(() => expect(mocks.write).toHaveBeenCalledWith("deployment:alice", "false"));
  first.unmount();
  render(view());
  expect(screen.getAllByText("loading")).toHaveLength(2);
  await waitFor(() => expect(screen.getAllByText("false")).toHaveLength(2));
});

it("keeps the latest value when changes are batched before a render", async () => {
  function BatchedChanges() {
    const { ready, setShowInMain } = useMonthlyCardPreference();
    return <button disabled={!ready} onClick={() => { setShowInMain(false); setShowInMain(true); }}>Change twice</button>;
  }
  render(<MonthlyCardPreferenceProvider><Consumer /><BatchedChanges /></MonthlyCardPreferenceProvider>);
  await screen.findByText("true");
  fireEvent.click(screen.getByRole("button", { name: "Change twice" }));
  expect(screen.getByText("true")).toBeDefined();
  expect(mocks.write).toHaveBeenLastCalledWith("deployment:alice", "true");
});

it("does not expose another account's value or accept a stale read after switching accounts", async () => {
  let resolveAlice!: (raw: string | null) => void;
  mocks.read.mockImplementation((key: string) => key === "deployment:alice" ? new Promise((resolve) => { resolveAlice = resolve; }) : Promise.resolve("false"));
  const { rerender } = render(view());
  expect(screen.getAllByText("loading")).toHaveLength(2);
  mocks.accountKey = "deployment:bob";
  rerender(view());
  await waitFor(() => expect(screen.getAllByText("false")).toHaveLength(2));
  await act(async () => resolveAlice("true"));
  expect(screen.getAllByText("false")).toHaveLength(2);
  mocks.accountKey = null;
  rerender(view());
  expect(screen.getAllByText("loading")).toHaveLength(2);
  expect(mocks.write).not.toHaveBeenCalled();
});

it("falls back to enabled if reading fails and keeps updates usable if writing fails", async () => {
  mocks.read.mockRejectedValue(new Error("unavailable"));
  mocks.write.mockRejectedValue(new Error("unavailable"));
  render(view());
  await waitFor(() => expect(screen.getAllByText("true")).toHaveLength(2));
  fireEvent.click(screen.getAllByRole("button")[0]);
  await waitFor(() => expect(mocks.write).toHaveBeenCalledOnce());
  fireEvent.click(screen.getAllByRole("button")[0]);
  await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(2));
  expect(screen.getAllByText("true")).toHaveLength(2);
});
