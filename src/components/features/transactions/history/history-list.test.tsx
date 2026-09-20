// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { HistoryList } from "./history-list";
import type { PipeHistoryEvent } from "./history-data";

const mocks = vi.hoisted(() => ({ query: vi.fn(), navigate: vi.fn() }));
const client = { query: mocks.query };
vi.mock("convex/react", () => ({ useConvex: () => client }));
vi.mock("expo-router", () => ({ useRouter: () => ({ navigate: mocks.navigate }) }));
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
vi.mock("@ui/Icon", () => ({ Icon: () => null, safeIconName: (name: string) => name }));
vi.mock("../components/TransactionItem", () => ({
  TransactionItem: ({ transaction }: { transaction: { title: string } }) => <span>{transaction.title}</span>,
}));
vi.mock("../components/TransactionCorrectionHistory/TransactionCorrectionHistoryModal", () => ({
  TransactionCorrectionHistoryModal: () => null,
}));

const trip: PipeHistoryEvent = {
  id: "trip-event" as Id<"pipeCreationEvents">, pipeId: "trip" as Id<"pipes">,
  ancestorIds: [], occurredAt: 0, deletedAt: 4000, name: "Madrid", icon: "airplane", pipeType: "pipe",
};
const payer: PipeHistoryEvent = { ...trip, id: "payer-event" as Id<"pipeCreationEvents">, pipeId: "payer" as Id<"pipes">, name: "Main" };
const expense = {
  id: "shared" as Id<"transactions">, kind: "expense" as const, title: "hotel", date: 2000,
  createdAt: 2000, value: -6000, from: trip.pipeId, paidFrom: payer.pipeId,
};
const props = { filters: {}, isLoading: false, isRefreshing: false, error: null, hasMore: false, loadMore: () => {}, refresh: () => {} };

describe("mixed History interaction", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.query.mockReset();
    mocks.query.mockImplementation(async (_ref, args) => {
      const matches = args.eventId === trip.id ? args.role === "from" : args.role === "paidFrom";
      return {
        transactions: matches && !args.summaryOnly ? [expense] : [],
        count: matches ? 1 : 0, spent: matches ? 6000 : 0,
        oldestDate: matches ? 2000 : null, latestDate: matches ? 2000 : null,
        isDone: true, cursor: null,
      };
    });
  });

  it("expands the same expense under both involved deleted pipes without navigating", async () => {
    render(<HistoryList {...props} items={[
      { kind: "pipe", date: 2000, event: trip }, { kind: "pipe", date: 2000, event: payer },
    ]} />);
    await waitFor(() => expect(screen.getAllByText("Spent: 60.00")).toHaveLength(2));
    expect(screen.getAllByText("x1")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Expand Madrid history" }));
    await waitFor(() => expect(screen.getAllByText("hotel")).toHaveLength(1));
    await userEvent.click(screen.getByRole("button", { name: "Expand Main history" }));
    await waitFor(() => expect(screen.getAllByText("hotel")).toHaveLength(2));
    expect(mocks.navigate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Collapse Madrid history" }));
    expect(screen.getAllByText("hotel")).toHaveLength(1);
  });

  it("routes live events to the pipe and does not fetch an archive summary", async () => {
    render(<HistoryList {...props} items={[{ kind: "pipe", date: 0, event: { ...trip, deletedAt: undefined } }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Open Madrid" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ pathname: "/(main)/(tabs)/pipes", params: { pipeId: trip.pipeId } });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
