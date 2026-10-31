// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { PipeHistoryRow } from "./PipeHistoryRow";
import type { HistoryEntry } from "@features/transactions/history/events/event-groups";
import { colors } from "@/lib/styles";

vi.mock("@ui/Icon", () => ({ Icon: ({ name, color }: { name: string; color: string }) => <span data-testid={name} data-color={color} style={{ color }} />, safeIconName: (name: string) => name }));

const event: Extract<HistoryEntry, { type: "pipe_creation" }> = {
  id: "event" as Id<"events">,
  operationId: "event" as Id<"events">,
  type: "pipe_creation",
  createdAt: 0,
  pipeId: "trip" as Id<"pipes">,
  ancestorIds: ["parent" as Id<"pipes">],
  name: "Madrid",
  icon: "airplane",
  parentName: "Travel",
  occurredAt: Date.UTC(2026, 8, 1),
  pipeType: "pipe",
};

describe("pipe history rows", () => {
  it("preserves the parent, date, and deleted status in an archived creation's accessible name", () => {
    render(<PipeHistoryRow event={event} archived expanded={false} onPress={() => {}} />);
    expect(screen.getByLabelText("Madrid, pipe created, parent Travel, Sep 1, 2026, pipe now deleted")).toBeTruthy();
  });

  it("identifies a retained creation as creation even after its pipe was deleted", () => {
    render(<PipeHistoryRow event={event} archived expanded={false} onPress={() => {}} />);
    expect(screen.getByLabelText(/Madrid, pipe created/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Madrid" })).toBeNull();
    expect(screen.getByText("Deleted")).toBeTruthy();
  });

  it("explains an archived creation from its marker without opening the deleted pipe", async () => {
    const onPress = vi.fn();
    render(<PipeHistoryRow event={event} archived expanded={false} onPress={onPress} />);
    const marker = screen.getByRole("button", { name: "Event type: Created pipe", expanded: false });
    const details = screen.getByLabelText(/Madrid, pipe created/);
    expect(details.contains(marker)).toBe(false);
    expect(marker.contains(screen.getByTestId("pipe-creation"))).toBe(true);
    expect(screen.getByTestId("pipe-creation").getAttribute("data-color")).toBe(colors.text);
    expect(screen.getByTestId("airplane").getAttribute("data-color")).toBe(colors.muted);
    expect(screen.queryByTestId("pipe-deletion")).toBeNull();
    await userEvent.click(marker);
    expect(marker.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Created pipe")).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText("Created pipe"));
    expect(screen.getByText("Created pipe")).toBeTruthy();
    await userEvent.click(screen.getByTestId("popover-backdrop"));
    expect(screen.queryByText("Created pipe")).toBeNull();
    expect(screen.getByRole("button", { name: "Event type: Created pipe", expanded: false })).toBe(marker);
  });

  it.each([
    { pipeType: "feed", color: colors.primaryMuted },
    { pipeType: "boiler", color: colors.secondarySoft },
    { pipeType: "pipe", color: colors.text },
  ] as const)("uses the retained $pipeType creation color without reviving deleted pipe styling", ({ pipeType, color }) => {
    render(<PipeHistoryRow event={{ ...event, pipeType }} archived expanded={false} onPress={() => {}} />);
    expect(screen.getByLabelText(/Madrid, pipe created/)).toBeTruthy();
    expect(screen.getByTestId("pipe-creation").getAttribute("data-color")).toBe(color);
    expect(screen.getByTestId("airplane").getAttribute("data-color")).toBe(colors.muted);
    expect(screen.queryByRole("button", { name: "Open Madrid" })).toBeNull();
  });

  it("focuses the marker, archive details, and trailing counter in order and toggles with either row control", async () => {
    const onPress = vi.fn();
    render(<PipeHistoryRow event={{ ...event, type: "pipe_deletion" }} expanded={false} onPress={onPress}
      summary={{ count: 2, spent: 100, oldestDate: 1000, latestDate: 2000 }} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Event type: Deleted pipe" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Madrid archived history" }));
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Expand Madrid history" }));
    await userEvent.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("explains the deletion marker without expanding its archive", async () => {
    const onPress = vi.fn();
    render(<PipeHistoryRow event={{ ...event, type: "pipe_deletion" }} expanded={false} onPress={onPress}
      summary={{ count: 2, spent: 100, oldestDate: 1000, latestDate: 2000 }} />);
    await userEvent.click(screen.getByRole("button", { name: "Event type: Deleted pipe" }));
    expect(screen.getByText("Deleted pipe")).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("popover-backdrop"));
    expect(screen.getByRole("button", { name: "Madrid archived history", expanded: false })).toBeTruthy();
  });

  it("opens the live creation marker with the keyboard and dismisses with Escape without navigating", async () => {
    const onPress = vi.fn();
    render(<PipeHistoryRow event={event} expanded={false} onPress={onPress} />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("Created pipe")).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
    // RN Web enables Escape after the opening CSS animation, which jsdom does not run.
    const modal = screen.getByTestId("popover-backdrop").closest('[aria-modal="true"]')!;
    let node = modal.parentElement;
    while (node && node !== document.body) {
      fireEvent.animationEnd(node);
      fireEvent(node, new Event("webkitAnimationEnd", { bubbles: true }));
      node = node.parentElement;
    }
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("Created pipe")).toBeNull();
    expect(screen.getByRole("button", { name: "Event type: Created pipe", expanded: false })).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
  });

  it("keeps live creation details informational with their parent and creation date", async () => {
    const onPress = vi.fn();
    render(<PipeHistoryRow event={event} onPress={onPress} expanded={false} />);
    await userEvent.click(screen.getByText("Madrid"));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Open Madrid" })).toBeNull();
    expect(screen.getByLabelText("Madrid, pipe created, parent Travel, Sep 1, 2026")).toBeTruthy();
    expect(screen.getByText("Travel ›")).toBeTruthy();
    expect(screen.queryByText(/Spent/)).toBeNull();
    expect(screen.queryByText(/Initial/)).toBeNull();
  });
  it("uses xN and Spent for deleted archives and exposes expansion accessibly", async () => {
    const onPress = vi.fn();
    render(<PipeHistoryRow event={{ ...event, type: "pipe_deletion" }} expanded={false} onPress={onPress}
      summary={{ count: 24, spent: 12000, oldestDate: 1000, latestDate: 2000 }} />);
    expect(screen.getByText("x24")).toBeTruthy();
    expect(screen.getByText("Spent: 120.00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Madrid archived history", expanded: false })).toBeTruthy();
    const icon = screen.getByTestId("airplane");
    expect(icon.getAttribute("data-color")).toBe(colors.muted);
    expect(getComputedStyle(screen.getByRole("button", { name: "Madrid archived history" })).borderTopColor).toBe(icon.style.color);
    await userEvent.click(screen.getByRole("button", { name: "Expand Madrid history", expanded: false }));
    expect(onPress).toHaveBeenCalledOnce();
  });
  it("shows loaded-member counts and amounts immediately without completeness gating", () => {
    render(<PipeHistoryRow event={{ ...event, type: "pipe_deletion" }} expanded={false} onPress={() => {}}
      summary={{ count: 3, spent: 100, oldestDate: 1000, latestDate: 2000 }} />);
    expect(screen.getByText("x3")).toBeTruthy();
    expect(screen.getByText("Spent: 1.00")).toBeTruthy();
    expect(screen.queryByText("Loading totals…")).toBeNull();
  });
  it("keeps an empty archive as a dated deletion record without an expandable control", () => {
    const onPress = vi.fn();
    render(<PipeHistoryRow event={{ ...event, type: "pipe_deletion", occurredAt: Date.UTC(2026, 8, 22) }} expanded={false} onPress={onPress}
      summary={{ count: 0, spent: 0, oldestDate: null, latestDate: null }} />);
    expect(screen.getByText("Deleted")).toBeTruthy();
    expect(screen.getByText("Sep 22, 2026")).toBeTruthy();
    expect(screen.queryByText("Sep 1, 2026")).toBeNull();
    expect(screen.getByTestId("airplane").getAttribute("data-color")).toBe(colors.muted);
    expect(screen.queryByText("No retained transactions")).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand Madrid history" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Madrid archived history" })).toBeNull();
    expect(screen.queryByText("x0")).toBeNull();
  });
});
