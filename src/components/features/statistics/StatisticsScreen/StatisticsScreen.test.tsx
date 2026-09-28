// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "convex/react";
import { beforeEach, expect, it, vi } from "vitest";
import { StatisticsScreen } from "./StatisticsScreen";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@convex/_generated/api", () => ({
  api: { monthlySpendingStats: { listMine: "listMonthlySpendingStats" }, pipes: { getPipes: "getPipes" } },
}));
vi.mock("@ui/Icon", () => ({
  Icon: ({ name, testID }: { name: string; testID?: string }) => <span data-testid={testID ?? "icon"} data-icon-name={name} />,
  safeIconName: (name: string) => name,
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@features/app/AppScreenHeader", () => ({
  AppScreenHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

beforeEach(() => {
  vi.mocked(useQuery).mockReturnValue([]);
});

it("shows an empty message when no monthly reports exist", () => {
  render(<StatisticsScreen onSelectPeriod={vi.fn()} />);

  expect(screen.getByText("Statistics")).toBeDefined();
  expect(screen.getByText("No monthly statistics yet.")).toBeDefined();
});

it("shows a monthly summary card and selects its report", async () => {
  const user = userEvent.setup();
  const onSelectPeriod = vi.fn();
  const periodStart = Date.UTC(2026, 5, 1);
  vi.mocked(useQuery).mockReturnValue([
    {
      periodStart,
      totalIncomeCents: 50_000,
      grossSpendingCents: 2_000,
      refundCents: 250,
      spendingTransactionCount: 2,
      refundTransactionCount: 1,
      largestSpendingTransactionCents: 1_200,
    },
  ] as any);

  render(<StatisticsScreen onSelectPeriod={onSelectPeriod} />);

  expect(screen.getByText("June 2026")).toBeDefined();
  expect(screen.getByText("Total outcome")).toBeDefined();
  expect(screen.getByText("17.50")).toBeDefined();
  expect(screen.getByText((_, element) => element?.textContent === "Gross 20.00")).toBeDefined();
  expect(screen.getByText((_, element) => element?.textContent === "Refunds: 2.50")).toBeDefined();

  await user.click(
    screen.getByRole("button", { name: "Open June 2026 spending report" }),
  );
  expect(onSelectPeriod).toHaveBeenCalledWith(periodStart);
});

it("shows the top frozen offender on a saved card and marks legacy rankings unavailable", () => {
  vi.mocked(useQuery).mockReturnValue([
    { periodStart: Date.UTC(2026, 5, 1), grossSpendingCents: 600, refundCents: 0, offenders: [{ pipeId: "leaf", name: "Groceries", netSpendingCents: 600, capacityCents: 400, overageCents: 200 }] },
    { periodStart: Date.UTC(2026, 4, 1), grossSpendingCents: 0, refundCents: 0 },
  ] as any);
  render(<StatisticsScreen onSelectPeriod={vi.fn()} />);
  expect(screen.getByText(/Groceries/)).toBeDefined();
  expect(screen.getAllByText(/Unavailable/).length).toBeGreaterThan(0);
});

it("shows the current icon only when a frozen offender's pipe still exists", () => {
  vi.mocked(useQuery).mockImplementation((query: any, _args?: any) => query === "getPipes" ? [
    { _id: "leaf", name: "Renamed", icon: "cart" },
  ] as any : [
    { periodStart: Date.UTC(2026, 5, 1), grossSpendingCents: 600, refundCents: 0, offenders: [{ pipeId: "leaf", name: "Groceries", netSpendingCents: 600, capacityCents: 400, overageCents: 200 }] },
    { periodStart: Date.UTC(2026, 4, 1), grossSpendingCents: 600, refundCents: 0, offenders: [{ pipeId: "deleted", name: "Old pipe", netSpendingCents: 600, capacityCents: 400, overageCents: 200 }] },
  ] as any);

  render(<StatisticsScreen onSelectPeriod={vi.fn()} />);

  expect(screen.getAllByTestId("offender-pipe-icon")).toHaveLength(1);
  expect(screen.getByTestId("offender-pipe-icon").getAttribute("data-icon-name")).toBe("cart");
  expect(screen.getByText(/Groceries/)).toBeDefined();
  expect(screen.getByText(/Old pipe/)).toBeDefined();
});

it("shows the frozen month's most repeated expense and net amount on the card", () => {
  vi.mocked(useQuery).mockReturnValue([
    { periodStart: Date.UTC(2026, 5, 1), grossSpendingCents: 700, refundCents: 50,
      mostRepeatedTransaction: { title: "coffee", count: 3, netSpendingCents: 450 } },
  ] as any);
  render(<StatisticsScreen onSelectPeriod={vi.fn()} />);
  expect(screen.getByText("Most repeated:")).toBeDefined();
  expect(screen.getByText((_, element) => element?.textContent === "coffee · 4.50 (3x)")).toBeDefined();
});
