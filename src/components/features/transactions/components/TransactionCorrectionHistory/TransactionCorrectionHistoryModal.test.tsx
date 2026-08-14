// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePaginatedQuery } from "convex/react";
import { TransactionCorrectionHistoryModal } from "./TransactionCorrectionHistoryModal";

vi.mock("convex/react", () => ({
  usePaginatedQuery: vi.fn(),
}));

vi.mock("@ui/Modal", () => ({
  ModalShell: ({ visible, children }: any) => (visible ? <div>{children}</div> : null),
}));

vi.mock("@ui/Button", () => ({
  Button: ({ title, onPress }: any) => <button onClick={onPress}>{title}</button>,
}));

describe("TransactionCorrectionHistoryModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePaginatedQuery).mockReturnValue({
      results: [
        {
          correctionId: "correction-1",
          editedAt: new Date("2024-03-20").getTime(),
          previous: { title: "coffee", value: -1000, date: new Date("2024-03-15").getTime() },
          current: { title: "coffee", value: -1200, date: new Date("2024-03-20").getTime() },
        },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
    } as any);
  });

  it("shows the read-only correction timeline and closes it", () => {
    render(
      <TransactionCorrectionHistoryModal
        visible
        transactionId={"tx-1" as any}
        transactionTitle="coffee"
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Edit history")).toBeDefined();
    expect(screen.getByText("Amount changed")).toBeDefined();
    expect(screen.getByText("-10.00 → -12.00")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Close edit history" }));
    expect(onClose).toHaveBeenCalled();
  });
});
