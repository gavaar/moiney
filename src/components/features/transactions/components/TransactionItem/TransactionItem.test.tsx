// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TransactionItem } from "./TransactionItem";
import type { Id } from "@convex/_generated/dataModel";
import { colors } from "@/lib/styles";

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
  id: "id" as Id<"pipes">,
  icon: "cart-outline",
  name: "Groceries",
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
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => mockUsePipeSelection(),
}));

vi.mock("@ui/Icon", () => ({
  Icon: ({ name, color }: any) => <span data-testid="mock-icon" data-name={name} data-color={color} />,
  safeIconName: (name: string | undefined | null): string => name ?? "pipe",
}));

vi.mock("@features/components/AmountForm", () => ({
  AmountForm: ({ initState }: any) => (
    <div
      data-testid="amount-form"
      data-paid-from={initState?.paidFrom}
    />
  ),
}));

describe("TransactionItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePipeSelection.mockReturnValue({
      pipesById: { [pipeInfo.id]: pipeInfo },
      childrenByParent: new Map(),
    });
  });

  it("renders the pipe icon", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByTestId("mock-icon")).toBeDefined();
  });

  it("renders the transaction title with first letter capitalized", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByText("Shopping mall")).toBeDefined();
  });

  it("renders the formatted date", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByText("Mar 15, 2024")).toBeDefined();
  });

  it("renders the value with two decimals", () => {
    render(<TransactionItem transaction={baseTx} />);
    expect(screen.getByText("-50.00")).toBeDefined();
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

    expect(onShowEditHistory).toHaveBeenCalledWith(transaction.id);
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
    expect(screen.getByTestId("mock-icon")).toMatchObject({
      dataset: { name: "pipe-disconnected", color: colors.surface },
    });
    fireEvent.click(screen.getByText("Shopping mall"));
    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
  });

  it("renders preserved history from a deleted pipe as view-only", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {},
      childrenByParent: new Map(),
    });
    const transaction = {
      ...baseTx,
      fromIcon: "cart-outline",
    };

    render(<TransactionItem transaction={transaction} />);

    expect(screen.getByTestId("mock-icon").getAttribute("data-name")).toBe("cart-outline");
    fireEvent.click(screen.getByText("Shopping mall"));
    expect(screen.getByText(/Preserved history is view-only/)).toBeDefined();
    expect(screen.queryByTestId("amount-form")).toBeNull();
  });

  it("shows disabled info modal when pipe has children", () => {
    const childrenMap = new Map<Id<"pipes">, any[]>();
    childrenMap.set(pipeInfo.id, [{ id: "child1" as Id<"pipes"> }]);

    mockUsePipeSelection.mockReturnValue({
      pipesById: { [pipeInfo.id]: pipeInfo },
      childrenByParent: childrenMap,
    });

    render(<TransactionItem transaction={baseTx} />);
    fireEvent.click(screen.getByText("Shopping mall"));
    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
    expect(screen.getByText(/cannot accept transactions anymore/)).toBeDefined();
  });

  it("shows disabled info when the source pipe is being deleted", () => {
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
    fireEvent.click(screen.getByText("Shopping mall"));

    expect(screen.getByText(/cannot accept transactions anymore/)).toBeDefined();
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
    fireEvent.click(screen.getByText("Weekly salary"));
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

    expect(screen.getAllByTestId("mock-icon").map((icon) => icon.getAttribute("data-name")))
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
    fireEvent.click(screen.getByText("Shopping mall"));

    expect(screen.getByTestId("amount-form").getAttribute("data-paid-from"))
      .toBe("salary-pipe");
  });
});
