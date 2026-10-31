// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PanResponder } from "react-native";
import { TransactionItem } from "./TransactionItem";
import type { Id } from "@convex/_generated/dataModel";
import { colors } from "@/lib/styles";
import { preparePaidFromPipeEligibility } from "@features/pipes/data/paidFromEligibility";

const baseTx = {
  id: "tx1" as any,
  createdAt: 0,
  title: "shopping mall",
  kind: "expense" as const,
  value: -5000,
  date: new Date("2024-03-15").getTime(),
  from: "pipe-1" as Id<"pipes">,
};

const pipeInfo = {
  id: "pipe-1" as Id<"pipes">,
  icon: "cart-outline",
  name: "Groceries",
  spent: 12345,
  capacity: 50000,
};

const salaryPipe = {
  id: "salary-pipe" as Id<"pipes">,
  icon: "cash-outline",
  name: "Salary",
};

const rentPipe = {
  id: "rent-pipe" as Id<"pipes">,
  icon: "home-outline",
  name: "Rent",
};

const transferTx = {
  id: "tx-transfer" as any,
  createdAt: 0,
  title: "send to rent",
  kind: "transfer" as const,
  value: -5000,
  date: new Date("2024-03-15").getTime(),
  from: "salary-pipe" as Id<"pipes">,
  to: "rent-pipe" as Id<"pipes">,
};

const feedPipeInfo = {
  id: "pipe-1" as Id<"pipes">,
  icon: "cart-outline",
  name: "Groceries",
};

const feedTx = {
  id: "tx-feed" as any,
  createdAt: 0,
  title: "weekly salary",
  kind: "feed" as const,
  value: 100000,
  date: new Date("2024-03-15").getTime(),
  pipeId: "pipe-1" as Id<"pipes">,
  from: undefined,
  to: "pipe-1" as Id<"pipes">,
};

const mockUsePipeSelection = vi.fn();
const deleteMocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  deleteTransaction: vi.fn(),
  invalidateHistory: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: () => deleteMocks.deleteTransaction,
}));
vi.mock("@ui/ConfirmModal", () => ({
  useConfirmWithModal: () => deleteMocks.confirm,
}));
vi.mock("@ui/Alert", () => ({
  useAlert: () => ({
    error: deleteMocks.showError,
    success: deleteMocks.showSuccess,
  }),
}));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({
  useOptionalEventHistoryCache: () => ({
    invalidateHistory: deleteMocks.invalidateHistory,
  }),
}));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => {
    const catalog = mockUsePipeSelection();
    return {
      ...catalog,
      isPaidFromEligible: preparePaidFromPipeEligibility(Object.values(catalog.pipesById)),
    };
  },
}));

vi.mock("@ui/Icon", async importOriginal => ({
  ...await importOriginal<typeof import("@ui/Icon")>(),
  Icon: ({ name, color }: { name: string; color: string }) => <span data-testid="mock-icon" data-name={name} data-color={color} />,
}));

vi.mock("@ui/Modal", () => ({
  ModalShell: ({ children, visible }: any) => visible ? <div data-testid="modal-shell">{children}</div> : null,
}));

vi.mock("@features/transactions/TransactionForm/TransactionForm", () => ({
  TransactionForm: ({ initState }: any) => (
    <div
      data-testid="amount-form"
      data-intent={initState?.intent ?? "repeat"}
      data-operation-id={initState?.operationId}
      data-spent={initState?.spent}
      data-capacity={initState?.capacity}
      data-paid-from={
        initState?.structure?.type === "payByTransfer"
          ? initState.structure.paidFrom
          : undefined
      }
    />
  ),
}));

describe("TransactionItem", () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.clearAllMocks();
    deleteMocks.confirm.mockResolvedValue(false);
    deleteMocks.deleteTransaction.mockResolvedValue(null);
    deleteMocks.invalidateHistory.mockResolvedValue(undefined);
    mockUsePipeSelection.mockReturnValue({
      pipesById: { [pipeInfo.id]: pipeInfo },
      childrenByParent: new Map(),
    });
  });

  it("renders the pipe icon", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getAllByTestId("mock-icon").map((icon) => icon.dataset.name))
      .toContain("cart-outline");
  });

  it("reads a complete event operation only on action and opens edit with its operation ID", async () => {
    const { id: _id, ...presentation } = baseTx;
    const resolveTransaction = vi.fn().mockResolvedValue(baseTx);
    render(<TransactionItem transaction={presentation} resolveTransaction={resolveTransaction} />);
    expect(resolveTransaction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Shopping mall"));
    await waitFor(() => expect(screen.getByTestId("amount-form").getAttribute("data-operation-id")).toBe(baseTx.id));
    expect(screen.getByTestId("amount-form").getAttribute("data-intent")).toBe("edit");
  });

  it("opens correction history directly while reading the complete delete operation", async () => {
    const { id: _id, ...presentation } = baseTx;
    const resolveTransaction = vi.fn().mockResolvedValue(baseTx);
    const history = vi.fn();
    deleteMocks.confirm.mockResolvedValue(true);
    render(<TransactionItem transaction={{ ...presentation, editedAt: 2 }} resolveTransaction={resolveTransaction} onShowEditHistory={history} />);
    fireEvent.click(screen.getByLabelText("View edit history for shopping mall"));
    expect(history).toHaveBeenCalledOnce();
    expect(resolveTransaction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Delete shopping mall"));
    await waitFor(() => expect(deleteMocks.deleteTransaction).toHaveBeenCalledWith({ operationId: baseTx.id }));
  });

  it("reports a missing action target and discards resolution after the row unmounts", async () => {
    const { id: _id, ...presentation } = baseTx;
    const resolveTransaction = vi.fn().mockResolvedValue(null);
    const { unmount } = render(<TransactionItem transaction={presentation} resolveTransaction={resolveTransaction} />);
    fireEvent.click(screen.getByText("Shopping mall"));
    await waitFor(() => expect(deleteMocks.showError).toHaveBeenCalledWith("Transaction is no longer available. Pull to refresh."));
    unmount();
    let finish!: (value: typeof baseTx | null) => void;
    resolveTransaction.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const next = render(<TransactionItem transaction={presentation} resolveTransaction={resolveTransaction} />);
    fireEvent.click(screen.getByText("Shopping mall"));
    next.unmount();
    finish(null);
    await Promise.resolve();
    expect(deleteMocks.showError).toHaveBeenCalledOnce();
  });

  it("renders the transaction title with first letter capitalized", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByText("Shopping mall")).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit shopping mall, -50.00, Mar 15, 2024" })).toBeDefined();
  });

  it("renders the formatted date", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByText("Mar 15, 2024")).toBeDefined();
  });

  it("renders the value with two decimals", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByText("-50.00")).toBeDefined();
  });

  it("does not mount AmountForm before the transaction row is opened", () => {
    render(
      <TransactionItem
        transaction={{ ...baseTx, from: pipeInfo.id }}
      />,
    );

    expect(screen.queryByTestId("amount-form")).toBeNull();
    expect(screen.queryByText("Cannot repeat transaction")).toBeNull();
  });

  it("passes the current pipe spending summary to the repeat form", () => {
    render(
      <TransactionItem
        transaction={{ ...baseTx, from: pipeInfo.id }}
      />,
    );

    fireEvent.click(screen.getByLabelText("Repeat shopping mall"));

    expect(screen.getByTestId("amount-form").getAttribute("data-spent")).toBe(
      "12345",
    );
    expect(
      screen.getByTestId("amount-form").getAttribute("data-capacity"),
    ).toBe("50000");
  });

  it("opens edit on tap", () => {
    render(
      <TransactionItem
        transaction={{ ...baseTx, from: pipeInfo.id }}
      />,
    );

    fireEvent.click(screen.getByText("Shopping mall"));

    expect(screen.getByTestId("amount-form").getAttribute("data-intent"))
      .toBe("edit");
  });

  it("opens repeat from a left swipe", () => {
    const original = PanResponder.create;
    const gestures = vi.spyOn(PanResponder, "create").mockImplementation(config => original(config));
    render(<TransactionItem transaction={baseTx} />);
    const config = gestures.mock.calls.at(-1)![0];
    const gesture = { dx: -45, dy: 0 } as Parameters<NonNullable<typeof config.onPanResponderRelease>>[1];

    act(() => config.onPanResponderRelease?.({} as never, gesture));

    expect(screen.getByTestId("amount-form").getAttribute("data-intent")).toBe("repeat");
  });

  it("opens a destructive confirmation from the accessible delete action", async () => {
    render(<TransactionItem transaction={baseTx} />);

    fireEvent.click(screen.getByLabelText("Delete shopping mall"));

    await waitFor(() => expect(deleteMocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete transaction?",
        confirmLabel: "Delete transaction",
        destructive: true,
      }),
    ));
    expect(deleteMocks.deleteTransaction).not.toHaveBeenCalled();
  });

  it("waits for the pipe catalog before offering deletion", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {},
      childrenByParent: new Map(),
      isLoading: true,
    });
    render(<TransactionItem transaction={baseTx} />);

    const action = screen.getByLabelText("Delete shopping mall");
    expect(action.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(action);
    expect(deleteMocks.confirm).not.toHaveBeenCalled();
  });

  it("disables edit and repeat while the pipe catalog is loading", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {},
      childrenByParent: new Map(),
      isLoading: true,
    });
    render(<TransactionItem transaction={baseTx} />);

    const edit = screen.getByRole("button", { name: /^Edit shopping mall,/ });
    const repeat = screen.getByRole("button", { name: "Why shopping mall cannot be repeated" });
    for (const action of [edit, repeat]) {
      expect(action.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(action);
    }
    expect(screen.queryByTestId("amount-form")).toBeNull();
    expect(screen.queryByTestId("modal-shell")).toBeNull();
  });

  it("disables both form actions while resolving an operation", async () => {
    const { id: _id, ...presentation } = baseTx;
    let finish!: (value: typeof baseTx) => void;
    const resolveTransaction = vi.fn(() => new Promise<typeof baseTx>(resolve => { finish = resolve; }));
    render(<TransactionItem transaction={presentation} resolveTransaction={resolveTransaction} />);

    fireEvent.click(screen.getByText("Shopping mall"));
    const edit = screen.getByRole("button", { name: /^Edit shopping mall,/ });
    const repeat = screen.getByRole("button", { name: "Repeat shopping mall" });
    for (const action of [edit, repeat]) {
      expect(action.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(action);
    }
    expect(resolveTransaction).toHaveBeenCalledOnce();
    await act(async () => finish(baseTx));
    expect(screen.getByTestId("amount-form").getAttribute("data-intent")).toBe("edit");
  });

  it("deletes and removes a confirmed transaction from the cache", async () => {
    deleteMocks.confirm.mockResolvedValue(true);
    render(<TransactionItem transaction={baseTx} />);

    fireEvent.click(screen.getByLabelText("Delete shopping mall"));

    await waitFor(() => expect(deleteMocks.deleteTransaction).toHaveBeenCalledWith({
      operationId: baseTx.id,
    }));
    expect(deleteMocks.invalidateHistory).toHaveBeenCalledOnce();
    expect(deleteMocks.showSuccess).toHaveBeenCalledWith("Transaction deleted");
  });

  it("keeps the cached transaction and reports deletion failures", async () => {
    deleteMocks.confirm.mockResolvedValue(true);
    deleteMocks.deleteTransaction.mockRejectedValue(new Error("blocked"));
    render(<TransactionItem transaction={baseTx} />);

    fireEvent.click(screen.getByLabelText("Delete shopping mall"));

    await waitFor(() => expect(deleteMocks.showError).toHaveBeenCalledWith("Error: blocked"));
    expect(deleteMocks.invalidateHistory).not.toHaveBeenCalled();
  });

  it("reports server deletion success even if history invalidation fails", async () => {
    deleteMocks.confirm.mockResolvedValue(true);
    deleteMocks.invalidateHistory.mockRejectedValue(new Error("storage failed"));
    render(<TransactionItem transaction={baseTx} />);

    fireEvent.click(screen.getByLabelText("Delete shopping mall"));

    await waitFor(() => expect(deleteMocks.showSuccess).toHaveBeenCalledWith("Transaction deleted"));
    expect(deleteMocks.invalidateHistory).toHaveBeenCalledOnce();
    expect(deleteMocks.showError).not.toHaveBeenCalled();
  });

  it("opens edit history from the Edited control", () => {
    const onShowEditHistory = vi.fn();
    const transaction = { ...baseTx, editedAt: Date.now() };

    render(
      <TransactionItem
        transaction={transaction}
        onShowEditHistory={onShowEditHistory}
      />,
    );

    fireEvent.click(screen.getByTestId("transaction-edit-history"));

    expect(onShowEditHistory).toHaveBeenCalledOnce();
  });

  it("renders positive value without sign", () => {
    const tx = { ...baseTx, value: 12050 };
    render(<TransactionItem transaction={tx} />);
    expect(screen.getByText("120.50")).toBeDefined();
  });

  it("renders all data in a single row", () => {
    const { container } = render(
      <TransactionItem transaction={baseTx} />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toBeDefined();
  });

  it("renders value in white", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByText("-50.00")).toBeDefined();
  });

  it("renders value in white for positive", () => {
    const tx = { ...baseTx, value: 7500 };
    render(<TransactionItem transaction={tx} />);
    expect(screen.getByText("75.00")).toBeDefined();
  });

  it("shows disabled info modal when pipe does not exist", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {},
      childrenByParent: new Map(),
    });

    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getAllByTestId("mock-icon").find(
      (icon) => icon.dataset.name === "pipe-disconnected",
    )).toMatchObject({
      dataset: { name: "pipe-disconnected", color: colors.surface },
    });
    expect(screen.queryByText("Cannot repeat transaction")).toBeNull();
    fireEvent.click(screen.getByLabelText("Why shopping mall cannot be repeated"));
    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
    expect(screen.queryByTestId("amount-form")).toBeNull();
  });

  it("offers edit for preserved history while keeping repeat unavailable", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {},
      childrenByParent: new Map(),
    });
    const transaction = {
      ...baseTx,
      fromIcon: "cart-outline",
    };

    render(<TransactionItem transaction={transaction} />);

    expect(screen.getAllByTestId("mock-icon").map((icon) => icon.getAttribute("data-name")))
      .toContain("cart-outline");
    expect(screen.queryByText(/Preserved history is view-only/)).toBeNull();
    const repeat = screen.getByRole("button", { name: "Why shopping mall cannot be repeated" });
    expect(repeat.getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(repeat);
    expect(screen.getByText(/Select valid pipes to edit it/)).toBeDefined();
    expect(screen.queryByTestId("amount-form")).toBeNull();
    expect(screen.getByLabelText("Delete shopping mall")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /^Edit shopping mall,/ }));
    expect(screen.getByTestId("amount-form").getAttribute("data-intent")).toBe("edit");
  });

  it("allows editing a transfer with a deleted destination to select a replacement", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: { [salaryPipe.id]: salaryPipe },
      childrenByParent: new Map(),
    });
    render(<TransactionItem transaction={{ ...transferTx, toIcon: "home-outline" }} />);
    fireEvent.click(screen.getByRole("button", { name: /^Edit send to rent,/ }));
    expect(screen.getByTestId("amount-form").getAttribute("data-intent")).toBe("edit");
    fireEvent.click(screen.getByLabelText("Why send to rent cannot be repeated"));
    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
  });

  it("shows disabled info modal when pipe has children", () => {
    const childrenMap = new Map<Id<"pipes">, any[]>();
    childrenMap.set(pipeInfo.id, [{ id: "child1" as Id<"pipes"> }]);

    mockUsePipeSelection.mockReturnValue({
      pipesById: { [pipeInfo.id]: pipeInfo },
      childrenByParent: childrenMap,
    });

    render(<TransactionItem transaction={baseTx} />);
    expect(screen.queryByText("Cannot repeat transaction")).toBeNull();
    expect(screen.queryByTestId("amount-form")).toBeNull();
    fireEvent.click(screen.getByLabelText("Why shopping mall cannot be repeated"));
    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
    expect(screen.getByText(/cannot accept transactions anymore/)).toBeDefined();
    expect(screen.queryByTestId("amount-form")).toBeNull();
    expect(screen.getByRole("button", { name: /^Edit shopping mall,/ })).toBeDefined();
  });

  it("explains the deletion freeze when edit is attempted", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {
        "pipe-1": {
          id: "pipe-1" as Id<"pipes">,
          icon: pipeInfo.icon,
          name: pipeInfo.name,
          deletionJobId: "job-1",
        },
      },
      childrenByParent: new Map(),
    });

    render(<TransactionItem transaction={baseTx} />);
    fireEvent.click(screen.getByRole("button", { name: /^Why shopping mall cannot be edited,/ }));

    expect(screen.getByText("Cannot edit transaction")).toBeDefined();
    expect(screen.getByText(/being deleted/)).toBeDefined();
    expect(screen.queryByText("Cannot repeat transaction")).toBeNull();
    expect(screen.queryByTestId("amount-form")).toBeNull();
  });

  it("explains the deletion freeze when repeat is attempted", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: { [pipeInfo.id]: { ...pipeInfo, deletionJobId: "job-1" } },
      childrenByParent: new Map(),
    });
    render(<TransactionItem transaction={baseTx} />);

    const repeat = screen.getByRole("button", { name: "Why shopping mall cannot be repeated" });
    expect(repeat.getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(repeat);

    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
    expect(screen.getByText(/being deleted/)).toBeDefined();
    expect(screen.queryByTestId("amount-form")).toBeNull();
  });
});

describe("TransactionItem transfer variant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePipeSelection.mockReturnValue({
      pipesById: {
        "salary-pipe": salaryPipe,
        "rent-pipe": rentPipe,
      },
      childrenByParent: new Map(),
    });
  });

  it("renders source icon, arrow, and destination icon", () => {
    render(<TransactionItem transaction={transferTx} />);
    const icons = screen.getAllByTestId("mock-icon");
    const iconNames = icons.map((i) => i.getAttribute("data-name"));
    expect(iconNames).toContain("cash-outline");
    expect(iconNames).toContain("ray-start-arrow");
    expect(iconNames).toContain("home-outline");
  });

  it("renders transfer title and date and value", () => {
    render(<TransactionItem transaction={transferTx} />);
    expect(screen.getByText("Send to rent")).toBeDefined();
    expect(screen.getByText("Mar 15, 2024")).toBeDefined();
    expect(screen.getByText("-50.00")).toBeDefined();
  });

  it("uses ray-end-arrow for positive value (source receives)", () => {
    const tx = { ...transferTx, value: 10000 };
    render(<TransactionItem transaction={tx} />);
    const icons = screen.getAllByTestId("mock-icon");
    const iconNames = icons.map((i) => i.getAttribute("data-name"));
    expect(iconNames).toContain("ray-end-arrow");
    expect(iconNames).not.toContain("ray-start-arrow");
  });

  it("spend transaction does not render arrow icons", () => {
    render(<TransactionItem transaction={baseTx} />);
    const icons = screen.getAllByTestId("mock-icon");
    const iconNames = icons.map((i) => i.getAttribute("data-name"));
    expect(iconNames).not.toContain("ray-start-arrow");
    expect(iconNames).not.toContain("ray-end-arrow");
  });
});

describe("TransactionItem feed variant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePipeSelection.mockReturnValue({
      pipesById: { [feedPipeInfo.id]: feedPipeInfo },
      childrenByParent: new Map(),
    });
  });

  it("renders the destination (fed) pipe icon", () => {
    render(<TransactionItem transaction={feedTx} />);
    const icons = screen.getAllByTestId("mock-icon");
    const iconNames = icons.map((i) => i.getAttribute("data-name"));
    expect(iconNames).toContain("cart-outline");
  });

  it("does not render arrow icons", () => {
    render(<TransactionItem transaction={feedTx} />);
    const icons = screen.getAllByTestId("mock-icon");
    const iconNames = icons.map((i) => i.getAttribute("data-name"));
    expect(iconNames).not.toContain("ray-start-arrow");
    expect(iconNames).not.toContain("ray-end-arrow");
  });

  it("renders feed title and date and value", () => {
    render(<TransactionItem transaction={feedTx} />);
    expect(screen.getByText("Weekly salary")).toBeDefined();
    expect(screen.getByText("Mar 15, 2024")).toBeDefined();
    expect(screen.getByText("1,000.00")).toBeDefined();
  });

  it("shows disabled info modal when fed pipe does not exist", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {},
      childrenByParent: new Map(),
    });

    render(<TransactionItem transaction={feedTx} />);
    fireEvent.click(screen.getByLabelText("Why weekly salary cannot be repeated"));
    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
  });
});

describe("TransactionItem pay-by-transfer variant", () => {
  it("renders payer, arrow, and spending category icons in that order", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {
        "salary-pipe": salaryPipe,
        "rent-pipe": rentPipe,
      },
      childrenByParent: new Map(),
    });
    const tx = {
      ...baseTx,
      from: "rent-pipe" as Id<"pipes">,
      paidFrom: "salary-pipe" as Id<"pipes">,
    };

    render(<TransactionItem transaction={tx} />);

    expect(screen.getAllByTestId("mock-icon").map((icon) => icon.getAttribute("data-name")).slice(-3))
      .toEqual(["cash-outline", "ray-start-arrow", "home-outline"]);
  });

  it("opens repeat with the individual paidFrom provenance", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {
        "salary-pipe": salaryPipe,
        "rent-pipe": rentPipe,
      },
      childrenByParent: new Map(),
    });
    const tx = {
      ...baseTx,
      from: "rent-pipe" as Id<"pipes">,
      paidFrom: "salary-pipe" as Id<"pipes">,
    };

    render(<TransactionItem transaction={tx} />);
    fireEvent.click(screen.getByLabelText("Repeat shopping mall"));

    expect(screen.getByTestId("amount-form").getAttribute("data-paid-from"))
      .toBe("salary-pipe");
  });

  it.each([5000, -5000])("allows only refunds to an external root with children (value %i)", (value) => {
    const salaryChild = { id: "salary-child" as Id<"pipes">, parentId: salaryPipe.id };
    mockUsePipeSelection.mockReturnValue({
      pipesById: {
        "salary-pipe": salaryPipe,
        "rent-pipe": rentPipe,
        [salaryChild.id]: salaryChild,
      },
      childrenByParent: new Map([[salaryPipe.id, [salaryChild]],]),
    });
    const tx = {
      ...baseTx,
      value,
      from: "rent-pipe" as Id<"pipes">,
      paidFrom: "salary-pipe" as Id<"pipes">,
    };

    render(<TransactionItem transaction={tx} />);
    fireEvent.click(screen.getByLabelText(value > 0 ? "Repeat shopping mall" : "Why shopping mall cannot be repeated"));

    if (value > 0) {
      expect(screen.getByTestId("amount-form").getAttribute("data-paid-from"))
        .toBe("salary-pipe");
      expect(screen.queryByText("Cannot repeat transaction")).toBeNull();
    } else {
      expect(screen.queryByTestId("amount-form")).toBeNull();
      expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
    }
  });
});
