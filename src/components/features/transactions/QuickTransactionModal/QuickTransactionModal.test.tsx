// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { QuickTransactionModal } from "./QuickTransactionModal";

const onClose = vi.fn();
const pipe1 = {
  id: "pipe-1" as Id<"pipes">,
  name: "Groceries",
  icon: "cart",
  priority: 1,
  capacity: 50000,
  fed: 30000,
  spent: 12345,
};
const pipe2 = {
  id: "pipe-2" as Id<"pipes">,
  name: "Transport",
  icon: "car",
  priority: 2,
  capacity: 20000,
  fed: 15000,
  spent: 5000,
};

vi.mock("@features/transactions/cache/useTransactionHistory", () => ({
  useTransactionHistory: () => ({
    transactions: [
      { id: "tx-1", from: "pipe-2" },
      { id: "tx-2", from: "pipe-1" },
      { id: "tx-3", from: "pipe-2" },
    ],
    isLoading: false,
  }),
}));

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({
    allPipes: [pipe1, pipe2],
    childrenByParent: new Map(),
    isLoading: false,
  }),
}));

vi.mock("@ui/Modal", () => ({
  ModalShell: ({ children, onClose: close }: any) => (
    <div data-testid="modal">
      <button onClick={close}>Backdrop</button>
      {children}
    </div>
  ),
}));

vi.mock("@ui/Icon", () => ({
  Icon: ({ name }: any) => <span data-icon={name} />,
  safeIconName: (name: string) => name,
}));

vi.mock("@features/components/AmountForm", () => ({
  AmountForm: ({ pipeId, initState, onSuccess }: any) => (
    <div
      data-testid="amount-form"
      data-pipe-id={pipeId}
      data-intent={initState.intent}
      data-title={initState.title}
      data-value={initState.value}
      data-spent={initState.spent}
      data-capacity={initState.capacity}
    >
      <button onClick={onSuccess}>Submit</button>
    </div>
  ),
}));

describe("QuickTransactionModal", () => {
  beforeEach(() => {
    onClose.mockClear();
  });

  it("opens an empty create form for the leaf ranked from history", () => {
    render(<QuickTransactionModal onClose={onClose} />);

    const pipeButtons = screen.getAllByLabelText(/Create transaction from/);
    expect(pipeButtons.map((button) => button.textContent)).toEqual([
      "Transport (50.00 / 200.00)",
      "Groceries (123.45 / 500.00)",
    ]);

    fireEvent.click(pipeButtons[0]);

    const form = screen.getByTestId("amount-form");
    expect(form.getAttribute("data-pipe-id")).toBe("pipe-2");
    expect(form.getAttribute("data-intent")).toBe("create");
    expect(form.getAttribute("data-title")).toBe("");
    expect(form.getAttribute("data-value")).toBe("-");
    expect(form.getAttribute("data-spent")).toBe("5000");
    expect(form.getAttribute("data-capacity")).toBe("20000");

    fireEvent.click(screen.getByText("Submit"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
