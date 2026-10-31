// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SettlementDetailsModal } from "./SettlementDetailsModal";
import { event, coverage } from "../../settlement.test-fixtures";
import { colors } from "@/lib/styles";

vi.mock("@expo/vector-icons", () => {
  const FontIcon = ({ name, color }: { name: string; color: string }) => <span data-testid={`icon-${name}`} data-color={color} />;
  return { Ionicons: FontIcon, MaterialCommunityIcons: FontIcon, MaterialIcons: FontIcon };
});
vi.mock("react-native-svg", () => vi.importActual<typeof import("react-native-svg")>("react-native-svg/src/elements.web.ts"));

it.each(["settlement", "settlement_coverage"] as const)("uses warning only for coverage-symbol shields in %s details", type => {
  render(<SettlementDetailsModal event={{ ...event, type, icon: "shield", coverage }} onClose={() => {}} />);
  expect(screen.getByLabelText(`20.00 covered ${type === "settlement" ? "by" : "for"} Safety net`)).toBeTruthy();
  expect(screen.getAllByTestId("icon-shield").map(icon => icon.getAttribute("data-color")))
    .toEqual([colors.muted, colors.warning, colors.muted]);
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
