// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { SettlementEntry } from "@features/transactions/history/events/event-groups";
import { SettlementDetailsModal } from "./components/SettlementDetailsModal/SettlementDetailsModal";
import { SettlementHistoryRow } from "./components/HistoryRow/components/SettlementHistoryRow/SettlementHistoryRow";
import { event, coverage } from "./settlement.test-fixtures";

vi.mock("@expo/vector-icons", () => {
  const FontIcon = ({ name, color }: { name: string; color: string }) => <span data-testid={`icon-${name}`} data-color={color} />;
  return { Ionicons: FontIcon, MaterialCommunityIcons: FontIcon, MaterialIcons: FontIcon };
});
vi.mock("react-native-svg", () => vi.importActual<typeof import("react-native-svg")>("react-native-svg/src/elements.web.ts"));

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
