// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { PipeHistoryRow } from "./pipe-history-row";
import type { PipeHistoryEvent } from "./history-data";
import { colors } from "@/lib/styles";

vi.mock("@ui/Icon", () => ({ Icon: ({ name, color }: { name: string; color: string }) => <span data-testid={name} data-color={color} />, safeIconName: (name: string) => name }));

const event: PipeHistoryEvent = {
  id: "event" as Id<"pipeCreationEvents">, pipeId: "trip" as Id<"pipes">,
  ancestorIds: ["parent" as Id<"pipes">], name: "Madrid", icon: "airplane",
  parentName: "Travel", occurredAt: Date.UTC(2026, 8, 1), pipeType: "pipe",
};

describe("pipe history rows", () => {
  it("opens a live pipe and shows its parent and creation date without financial fields", async () => {
    const onPress = vi.fn();
    render(<PipeHistoryRow event={event} onPress={onPress} expanded={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Open Madrid" }));
    expect(onPress).toHaveBeenCalledOnce();
    expect(screen.getByText("Travel ›")).toBeTruthy();
    expect(screen.queryByText(/Spent/)).toBeNull();
    expect(screen.queryByText(/Initial/)).toBeNull();
  });
  it("uses xN and Spent for deleted archives and exposes expansion accessibly", async () => {
    const onPress = vi.fn();
    render(<PipeHistoryRow event={{ ...event, deletedAt: 123 }} expanded={false} onPress={onPress}
      summary={{ count: 24, spent: 12000, oldestDate: 1000, latestDate: 2000 }} />);
    expect(screen.getByText("x24")).toBeTruthy();
    expect(screen.getByText("Spent: 120.00")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Expand Madrid history" }));
    expect(onPress).toHaveBeenCalledOnce();
  });
  it("does not show a partial or zero total while the full summary is loading", () => {
    render(<PipeHistoryRow event={{ ...event, deletedAt: 123 }} expanded={false} onPress={() => {}} />);
    expect(screen.getByText("Loading totals…")).toBeTruthy();
    expect(screen.queryByText(/Spent:/)).toBeNull();
    expect(screen.queryByText("x0")).toBeNull();
  });
  it("keeps an empty archive as a dated deletion record without an expandable control", () => {
    const onPress = vi.fn();
    render(<PipeHistoryRow event={{ ...event, deletedAt: Date.UTC(2026, 8, 22) }} expanded={false} onPress={onPress}
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
