// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cloneElement, useEffect, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedShell } from "./AuthenticatedShell";
import { ConfirmModalProvider } from "@ui/ConfirmModal";

const viewport = vi.hoisted(() => ({ width: 1024, segments: ["(main)", "(tabs)", "pipes"] }));
const subscriptions = vi.hoisted(() => ({ mounts: 0, active: 0 }));
vi.mock("react-native", async importOriginal => {
  const native = await importOriginal<typeof import("react-native")>();
  return {
    ...native,
    useWindowDimensions: () => ({ width: viewport.width, height: 800, scale: 1, fontScale: 1 }),
    // Keep the real modal lifecycle/focus without waiting for CSS animations in jsdom.
    Modal: (props: ComponentProps<typeof native.Modal>) => <native.Modal {...props} animationType="none" />,
  };
});
vi.mock("expo-router", () => ({
  useSegments: () => viewport.segments,
  Link: ({ href, children }: { href: string; children: ReactElement<{ href?: string }> }) => cloneElement(children, { href }),
}));
vi.mock("@ui/Icon", async importOriginal => ({ ...await importOriginal<typeof import("@ui/Icon")>(), Icon: () => null }));
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
vi.mock("@convex/_generated/api", () => ({
  api: {
    pipes: { getPipes: "pipes", addPipe: "addPipe", addFeed: "addFeed" },
    transactions: { listRecentTitles: "titles" },
    financialOperations: { edit: "edit", create: "create", contributeToBoiler: "contribute" },
  },
}));
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: function useQuery(query: string) {
    useEffect(() => {
      if (query !== "pipes") return;
      subscriptions.mounts++; subscriptions.active++;
      return () => { subscriptions.active--; };
    }, [query]);
    return query === "pipes" ? [{ _id: "wallet", name: "Wallet", icon: "pipe", priority: 0, capacity: 0, fed: 10000, spent: 0 }] : [];
  },
}));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useOptionalEventHistoryCache: () => null }));
vi.mock("@features/transactions/cache/useEventHistory", () => ({ useEventHistory: () => ({ entries: [], isLoading: false }) }));

function Wrapper({ children }: { children: ReactNode }) {
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 1024, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    <ConfirmModalProvider>{children}</ConfirmModalProvider>
  </SafeAreaProvider>;
}

describe("AuthenticatedShell", () => {
  beforeEach(() => { viewport.width = 1024; viewport.segments = ["(main)", "(tabs)", "pipes"]; subscriptions.mounts = 0; subscriptions.active = 0; });

  it("exposes keyboard-reachable expanded destinations with the current destination identified", async () => {
    const user = userEvent.setup();
    render(<AuthenticatedShell><div>Screen content</div></AuthenticatedShell>, { wrapper: Wrapper });
    for (const name of ["Pipes", "History", "Statistics", "Profile"]) {
      const destination = screen.getByRole("link", { name });
      expect(destination.getAttribute("href")).toBe(`/${name.toLowerCase()}`);
      await user.tab();
      expect(document.activeElement).toBe(destination);
    }
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Profile" }));
    expect(screen.getByRole("link", { name: "Pipes" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "History" }).getAttribute("aria-current")).toBeNull();
    expect(screen.queryByRole("link", { name: /Create|Add/ })).toBeNull();
  });

  it("keeps navigation and Add on settings and report details without replacing the screen on resize", () => {
    const content = <AuthenticatedShell><input aria-label="Screen draft" defaultValue="" /></AuthenticatedShell>;
    const { rerender } = render(content, { wrapper: Wrapper });
    const draft = screen.getByRole("textbox", { name: "Screen draft" });
    fireEvent.change(draft, { target: { value: "Retained" } });
    for (const segments of [["(main)", "settings"], ["(main)", "(tabs)", "statistics", "2026-10-01"]]) {
      viewport.segments = segments;
      rerender(<AuthenticatedShell><input aria-label="Screen draft" defaultValue="" /></AuthenticatedShell>);
      expect(screen.getByRole("link", { name: "Statistics" }).getAttribute("aria-current")).toBe(segments[1] === "(tabs)" ? "page" : null);
      expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    }
    for (const width of [1023, 1024, 1600, 360]) {
      viewport.width = width;
      rerender(<AuthenticatedShell><input aria-label="Screen draft" defaultValue="" /></AuthenticatedShell>);
      expect(screen.getByRole("textbox", { name: "Screen draft" })).toBe(draft);
      expect(screen.getByDisplayValue("Retained")).toBeTruthy();
      expect(Boolean(screen.queryByRole("link", { name: "Pipes" }))).toBe(width >= 1024);
      expect(Boolean(screen.queryByRole("button", { name: "Add" }))).toBe(width >= 1024);
    }
  });

  it("preserves open creation mode, page, hidden drafts and its single subscription across the breakpoint", async () => {
    const user = userEvent.setup();
    viewport.segments = ["(main)", "settings"];
    const { rerender } = render(<AuthenticatedShell><div>Screen content</div></AuthenticatedShell>, { wrapper: Wrapper });
    const add = screen.getByRole("button", { name: "Add" });
    act(() => add.focus());
    await user.keyboard(" ");
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), { target: { value: "Lunch" } });
    fireEvent.click(screen.getByRole("tab", { name: "pipe" }));
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    fireEvent.click(screen.getByRole("button", { name: "Owner pipe" }));
    fireEvent.click(screen.getByRole("button", { name: /Wallet/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Food" } });
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Pipe draft" } });

    for (const width of [1023, 1024, 360, 1600]) {
      viewport.width = width;
      rerender(<AuthenticatedShell><div>Screen content</div></AuthenticatedShell>);
      expect(screen.getByRole("tab", { name: "pipe" }).getAttribute("aria-selected")).toBe("true");
      expect(screen.getByDisplayValue("Pipe draft")).toBeTruthy();
      expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
      expect(subscriptions.active).toBe(1);
      expect(subscriptions.mounts).toBe(1);
    }
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.getByDisplayValue("Food")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "transaction" }));
    expect(screen.getByDisplayValue("Lunch")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.getByText("Discard changes?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByDisplayValue("Lunch")).toBeTruthy();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.queryByRole("tab", { name: "transaction" })).toBeNull());
    expect(subscriptions.active).toBe(0);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add" }));
  }, 15000);
});
