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
  api: { monthlySpendingStats: { listMine: "listMonthlySpendingStats" } },
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
  expect(screen.getByText("Gross 20.00")).toBeDefined();
  expect(screen.getByText("Refunds 2.50")).toBeDefined();

  await user.click(
    screen.getByRole("button", { name: "Open June 2026 spending report" }),
  );
  expect(onSelectPeriod).toHaveBeenCalledWith(periodStart);
});
