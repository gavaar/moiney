// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { QuickTransactionModal } from "./QuickTransactionModal";

const onClose = vi.fn();
const createTransaction = vi.fn().mockResolvedValue(undefined);
vi.mock("convex/react", () => ({ useMutation: () => createTransaction, useQuery: () => [] }));
vi.mock("@convex/_generated/api", () => ({ api: { transactions: { createTransaction: {}, listRecentTitles: {} } } }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ error: vi.fn() }) }));
vi.mock("@features/transactions/cache/TransactionCacheContext", () => ({ useOptionalTransactionCache: () => null }));
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
    pipesById: { [pipe1.id]: pipe1, [pipe2.id]: pipe2 },
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

describe("QuickTransactionModal", () => {
  beforeEach(() => {
    onClose.mockClear();
  });

  it("selects ranked pipes, preserves the draft on Back, and submits for the newly selected pipe", async () => {
    render(<QuickTransactionModal onClose={onClose} />);

    const pipeButtons = screen.getAllByRole("radio");
    expect(pipeButtons.map((button) => button.textContent)).toEqual([
      "Transport (50.00 / 200.00)",
      "Groceries (123.45 / 500.00)",
    ]);

    fireEvent.click(pipeButtons[0]);

    expect(screen.getByRole("heading", { name: "Create: Transport (50.00 / 200.00)" })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), { target: { value: "Lunch" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Value" }), { target: { value: "5.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: /Transport/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /Groceries/ }));
    expect(screen.getByDisplayValue("Lunch")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Create: Groceries (123.45 / 500.00)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ title: "Lunch", value: -500, from: pipe1.id })));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
