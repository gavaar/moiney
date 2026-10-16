// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { SettlementEntry } from "./event-groups";
import { SettlementDetailsModal, SettlementHistoryRow } from "./settlement-history-row";

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
  MaterialCommunityIcons: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
  MaterialIcons: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));
const event: SettlementEntry = {
  type: "settlement",
  id: "settled" as Id<"events">,
  operationId: "settled" as Id<"events">,
  pipeId: "groceries" as Id<"pipes">,
  name: "Groceries",
  icon: "cart-outline",
  cause: "manual",
  createdAt: 1,
  occurredAt: 1,
  before: { capacity: 4000, fed: 4000, spent: 7000, pendingFedAdjustment: 500 },
  after: { capacity: 3000, fed: -500, spent: 0, pendingFedAdjustment: 0 },
};
const coverage = {
  amountCents: 2000,
  pipeId: "donor" as Id<"pipes">,
  name: "Safety net",
  icon: "shield",
  before: { capacity: 6000, fed: 6000, spent: 4000, pendingFedAdjustment: 0 },
  after: { capacity: 6000, fed: 6000, spent: 6000, pendingFedAdjustment: 0 }
};

it("renders stored coverage directly and opens donor details without implying the donor settled", () => {
  const stored = {
    amountCents: 2000,
    pipeId: "donor" as Id<"pipes">,
    name: "Safety net",
    icon: "shield",
    before: { capacity: 6000, fed: 6000, spent: 4000, pendingFedAdjustment: 0 },
    after: { capacity: 6000, fed: 6000, spent: 6000, pendingFedAdjustment: 0 }
  };
  const { unmount } = render(<SettlementHistoryRow event={{ ...event, coverage: stored }} onPress={() => {}} />);
  expect(screen.getByRole("button", { name: /20.00 covered by Safety net/ })).toBeTruthy();
  unmount();
  render(<SettlementDetailsModal event={{
    ...event,
    type: "settlement_coverage",
    name: "Safety net",
    icon: "shield",
    before: stored.before,
    after: stored.after,
    coverage: { ...stored, pipeId: event.pipeId, name: event.name, icon: event.icon, before: event.before, after: event.after }
  }} onClose={() => {}} />);
  expect(screen.getByText("Coverage provided")).toBeTruthy();
  expect(screen.getByLabelText("20.00 covered for Groceries")).toBeTruthy();
  expect(screen.getByLabelText("Spent after coverage: 60.00")).toBeTruthy();
  expect(screen.getByLabelText("Available funding: 0.00")).toBeTruthy();
  expect(screen.queryByText("Manually settled")).toBeNull();
});

it("announces donor coverage without describing the donor as settled", () => {
  const donor: SettlementEntry = {
    ...event,
    type: "settlement_coverage",
    name: "Safety net",
    icon: "shield",
    before: coverage.before,
    after: coverage.after,
    coverage: { ...coverage, pipeId: event.pipeId, name: event.name, icon: event.icon, before: event.before, after: event.after }
  };
  const { unmount } = render(<SettlementHistoryRow event={donor} onPress={() => {}} />);
  expect(screen.getByRole("button", { name: "View Safety net coverage: 20.00 covered for Groceries" })).toBeTruthy();
  unmount();
  render(<SettlementDetailsModal event={donor} onClose={() => {}} />);
  expect(screen.getByLabelText("Capacity before coverage: 60.00")).toBeTruthy();
  expect(screen.getByLabelText("Spent before coverage: 40.00")).toBeTruthy();
});

it("renders coverage inline with the real manual, shield, and donor icons", () => {
  render(<SettlementHistoryRow event={{ ...event, coverage }} onPress={() => {}} />);
  expect(screen.getByTestId("icon-gesture-tap-hold")).toBeTruthy();
  expect(screen.getAllByTestId("icon-shield")).toHaveLength(2);
  expect(screen.getByText("20.00")).toBeTruthy();
  expect(screen.getByRole("button", { name: /20.00 covered by Safety net/ })).toBeTruthy();
  expect(screen.queryByText("Manually settled")).toBeNull();
});

it("shows original capacity/spending, coverage, uncovered overspending, and signed outcome amounts", () => {
  render(<SettlementDetailsModal event={{ ...event, coverage }} onClose={() => {}} />);
  expect(screen.getByText("Before settlement")).toBeTruthy();
  expect(screen.getByText("After settlement")).toBeTruthy();
  expect(screen.getByText("Manually settled")).toBeTruthy();
  expect(screen.queryByText(/Configured rule/)).toBeNull();
  expect(screen.getByLabelText("Capacity before settlement: 40.00")).toBeTruthy();
  expect(screen.getByLabelText("Spent before settlement: 70.00")).toBeTruthy();
  expect(screen.getByText("Covered by")).toBeTruthy();
  expect(screen.getByLabelText("20.00 covered by Safety net")).toBeTruthy();
  expect(screen.getByText("Safety net")).toBeTruthy();
  expect(screen.getByLabelText("Leftover overspending: 10.00")).toBeTruthy();
  expect(screen.getByLabelText("Paid from elsewhere: 5.00")).toBeTruthy();
  expect(screen.getByLabelText("Leftover funding: -5.00")).toBeTruthy();
  expect(screen.getByLabelText("New capacity: 30.00")).toBeTruthy();
});

it("omits cleared overspending and distinguishes pending refunds from external payments", () => {
  render(<SettlementDetailsModal event={{
    ...event,
    before: { ...event.before, pendingFedAdjustment: -500 },
    coverage: { ...coverage, amountCents: 3000, before: { ...coverage.before, spent: 3000 } }
  }} onClose={() => {}} />);
  expect(screen.queryByLabelText(/Leftover overspending/)).toBeNull();
  expect(screen.queryByLabelText(/Paid from elsewhere/)).toBeNull();
  expect(screen.getByLabelText("Refunded elsewhere: 5.00")).toBeTruthy();
});

it("shows historical negative-capacity debt even when spending is zero", () => {
  render(<SettlementDetailsModal event={{
    ...event,
    before: { capacity: -1500, fed: 0, spent: 0, pendingFedAdjustment: 0 },
    after: { capacity: -1500, fed: 0, spent: 0, pendingFedAdjustment: 0 },
  }} onClose={() => {}} />);
  expect(screen.getByLabelText("Capacity before settlement: -15.00")).toBeTruthy();
  expect(screen.getByLabelText("Leftover overspending: 15.00")).toBeTruthy();
});

it("presents the donor mirror as coverage, not a second settlement of the donor", () => {
  render(<SettlementDetailsModal event={{
    ...event,
    type: "settlement_coverage",
    name: "Safety net",
    icon: "shield",
    before: { capacity: 6000, fed: 6000, spent: 2000, pendingFedAdjustment: 0 },
    after: { capacity: 6000, fed: 6000, spent: 4000, pendingFedAdjustment: 0 },
    coverage: { ...coverage, pipeId: event.pipeId, name: event.name, icon: event.icon, before: event.before, after: event.after },
  }} onClose={() => {}} />);
  expect(screen.getByText("Covered for")).toBeTruthy();
  expect(screen.getByLabelText("20.00 covered for Groceries")).toBeTruthy();
  expect(screen.getByText("Before coverage")).toBeTruthy();
  expect(screen.getByText("After coverage")).toBeTruthy();
  expect(screen.getByLabelText("Spent after coverage: 40.00")).toBeTruthy();
  expect(screen.getByLabelText("Available funding: 20.00")).toBeTruthy();
  expect(screen.getByLabelText("Capacity after coverage: 60.00")).toBeTruthy();
  expect(screen.queryByLabelText(/Leftover overspending|New capacity/)).toBeNull();
});

it("renders a zero-balance settlement without inventing overspending or external payment", () => {
  render(<SettlementDetailsModal event={{
    ...event,
    before: { capacity: 0, fed: 0, spent: 0, pendingFedAdjustment: 0 },
    after: { capacity: 0, fed: 0, spent: 0, pendingFedAdjustment: 0 },
  }} onClose={() => {}} />);
  expect(screen.getByLabelText("Spent before settlement: 0.00")).toBeTruthy();
  expect(screen.getByLabelText("Leftover funding: 0.00")).toBeTruthy();
  expect(screen.getByLabelText("New capacity: 0.00")).toBeTruthy();
  expect(screen.queryByLabelText(/Leftover overspending|Paid from elsewhere|Refunded elsewhere/)).toBeNull();
});
