// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePaginatedQuery } from "convex/react";
import { TransactionCorrectionHistoryModal } from "./TransactionCorrectionHistoryModal";
import type { ComponentProps } from "react";
import type { Id } from "@convex/_generated/dataModel";

vi.mock("convex/react", () => ({
  usePaginatedQuery: vi.fn(),
}));

vi.mock("@ui/Modal", () => ({
  ModalShell: ({ visible, children }: ComponentProps<typeof import("@ui/Modal").ModalShell>) => (visible ? <div>{children}</div> : null),
}));

vi.mock("@ui/Button", () => ({
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => <button onClick={onPress}>{title}</button>,
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
      isLoading: false,
      loadMore: vi.fn(),
    });
  });

  it("shows the read-only correction timeline without an internal close button", () => {
    render(
      <TransactionCorrectionHistoryModal
        visible
        operationId={"operation-1" as Id<"events">}
        transactionTitle="coffee"
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Edit history")).toBeDefined();
    expect(screen.getByText("Amount changed")).toBeDefined();
    expect(screen.getByText("-10.00 → -12.00")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Close edit history" })).toBeNull();
  });

  it("keeps the mounted timeline bounded after loading many correction pages", () => {
    vi.mocked(usePaginatedQuery).mockReturnValue({
      results: Array.from({ length: 200 }, (_, index) => ({
        correctionId: `correction-${index}`,
        editedAt: index,
        previous: { title: "coffee", value: -1000, date: 1 },
        current: { title: "coffee", value: -1200, date: 1 },
      })),
      status: "Exhausted",
      isLoading: false,
      loadMore: vi.fn(),
    });
    render(<TransactionCorrectionHistoryModal visible operationId={"operation" as Id<"events">} transactionTitle="coffee" onClose={onClose} />);
    expect(screen.getAllByText("Amount changed").length).toBeLessThan(200);
  });
});
