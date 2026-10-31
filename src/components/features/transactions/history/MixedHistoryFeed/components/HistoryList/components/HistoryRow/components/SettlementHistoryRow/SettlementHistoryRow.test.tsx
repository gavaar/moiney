// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SettlementHistoryRow } from "./SettlementHistoryRow";
import { event, coverage } from "../../../../settlement.test-fixtures";
import { colors } from "@/lib/styles";

vi.mock("@expo/vector-icons", () => {
  const FontIcon = ({ name, color }: { name: string; color: string }) => <span data-testid={`icon-${name}`} data-color={color} />;
  return { Ionicons: FontIcon, MaterialCommunityIcons: FontIcon, MaterialIcons: FontIcon };
});
vi.mock("react-native-svg", () => vi.importActual<typeof import("react-native-svg")>("react-native-svg/src/elements.web.ts"));

it.each(["settlement", "settlement_coverage"] as const)("explains the %s identifier without opening row details or conflating pipe-owned shields", async type => {
  const onPress = vi.fn();
  render(<SettlementHistoryRow event={{ ...event, type, icon: "shield", coverage }} onPress={onPress} />);
  const mirror = type === "settlement_coverage";
  const row = screen.getByRole("button", { name: `View Groceries ${mirror ? "coverage" : "settlement"}: 20.00 covered ${mirror ? "for" : "by"} Safety net` });
  const label = mirror ? "Coverage provided" : "Pipe settled";
  const marker = screen.getByRole("button", { name: `Event type: ${label}`, expanded: false });
  expect(row.contains(marker)).toBe(false);
  expect(screen.getAllByRole("button")).toHaveLength(2);
  if (mirror) {
    expect(within(marker).getByTestId("icon-shield").getAttribute("data-color")).toBe(colors.warning);
    expect(marker.querySelector("svg")).toBeNull();
  } else {
    expect(marker.querySelector("svg g")?.getAttribute("fill")).toBe(colors.secondary);
    expect(within(marker).queryByTestId("icon-shield")).toBeNull();
  }
  expect(within(row).getAllByTestId("icon-shield").map(icon => icon.getAttribute("data-color")))
    .toEqual([colors.muted, colors.warning, colors.muted]);
  expect(within(row).getByTestId("icon-gesture-tap-hold")).toBeTruthy();
  await userEvent.click(marker);
  expect(marker.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText(label)).toBeTruthy();
  expect(onPress).not.toHaveBeenCalled();
  await userEvent.click(screen.getByTestId("popover-backdrop"));
  expect(screen.queryByText(label)).toBeNull();
  expect(screen.getByRole("button", { name: `Event type: ${label}`, expanded: false })).toBe(marker);
  fireEvent.click(row);
  expect(onPress).toHaveBeenCalledOnce();
});

it("renders coverage inline with the real manual, shield, and donor icons", () => {
  render(<SettlementHistoryRow event={{ ...event, coverage }} onPress={() => {}} />);
  expect(screen.getByTestId("icon-gesture-tap-hold")).toBeTruthy();
  expect(screen.getAllByTestId("icon-shield")).toHaveLength(2);
  expect(screen.getByText("20.00")).toBeTruthy();
  expect(screen.getByRole("button", { name: /20.00 covered by Safety net/ })).toBeTruthy();
  expect(screen.queryByText("Manually settled")).toBeNull();
});
