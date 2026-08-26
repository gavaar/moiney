// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@convex/_generated/dataModel";
import type { TransactionModel } from "@features/transactions/data/transactions";
import { TransactionListWithHistory } from "./TransactionListWithHistory";

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({ allPipes: [] }),
}));

vi.mock("@features/transactions/components/TransactionList", () => ({
  TransactionList: ({ onShowEditHistory }: any) => (
    <button onClick={() => onShowEditHistory("tx-1")}>show history</button>
  ),
}));

vi.mock(
  "./components/TransactionCorrectionHistory/TransactionCorrectionHistoryModal",
  () => ({
    TransactionCorrectionHistoryModal: ({ transactionId, transactionTitle }: any) => (
      <div data-testid="correction-history">
        {transactionId}:{transactionTitle}
      </div>
    ),
  }),
);

const transaction: TransactionModel = {
  id: "tx-1" as Id<"transactions">,
  createdAt: 1,
  title: "Coffee",
  value: -500,
  date: 1,
  kind: "expense",
  from: "pipe-1" as Id<"pipes">,
};

describe("TransactionListWithHistory", () => {
  it("opens correction history for the selected transaction", async () => {
    const user = userEvent.setup();
    render(<TransactionListWithHistory transactions={[transaction]} />);

    await user.click(screen.getByText("show history"));

    expect(screen.getByTestId("correction-history").textContent).toBe("tx-1:Coffee");
  });
});
