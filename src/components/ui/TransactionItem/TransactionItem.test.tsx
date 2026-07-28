// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TransactionItem } from "./TransactionItem";
import type { Id } from "@convex/_generated/dataModel";

const baseTx = {
  _id: "tx1" as any,
  _creationTime: 0,
  title: "shopping mall",
  value: -50,
  date: new Date("2024-03-15").getTime(),
  from: "pipe-1" as Id<"pipes">,
  userId: "" as Id<"users">,
};

const pipeInfo = {
  id: "id" as Id<"pipes">,
  icon: "cart-outline",
  name: "Groceries",
};

const salaryPipe = {
  _id: "salary-pipe" as Id<"pipes">,
  icon: "cash-outline",
  name: "Salary",
};

const rentPipe = {
  _id: "rent-pipe" as Id<"pipes">,
  icon: "home-outline",
  name: "Rent",
};

const transferTx = {
  _id: "tx-transfer" as any,
  _creationTime: 0,
  title: "send to rent",
  value: -50,
  date: new Date("2024-03-15").getTime(),
  from: "salary-pipe" as Id<"pipes">,
  to: "rent-pipe" as Id<"pipes">,
  userId: "" as Id<"users">,
};

const feedPipeInfo = {
  _id: "pipe-1" as Id<"pipes">,
  icon: "cart-outline",
  name: "Groceries",
};

const feedTx = {
  _id: "tx-feed" as any,
  _creationTime: 0,
  title: "weekly salary",
  value: 1000,
  date: new Date("2024-03-15").getTime(),
  pipeId: "pipe-1" as Id<"pipes">,
  from: undefined,
  to: "pipe-1" as Id<"pipes">,
  userId: "" as Id<"users">,
};

const mockUsePipeSelection = vi.fn();
vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => mockUsePipeSelection(),
}));

vi.mock("@ui/Icon", () => ({
  Icon: ({ name }: any) => <span data-testid="mock-icon" data-name={name} />,
  safeIconName: (name: string | undefined | null): string => name ?? "pipe",
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

  it("renders positive value without sign", () => {
    const tx = { ...baseTx, value: 120.5 };
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
    const tx = { ...baseTx, value: 75 };
    render(<TransactionItem transaction={tx} />);
    expect(screen.getByText("75.00")).toBeDefined();
  });

  it("shows disabled info modal when pipe does not exist", () => {
    mockUsePipeSelection.mockReturnValue({
      pipesById: {},
      childrenByParent: new Map(),
    });

    render(<TransactionItem transaction={baseTx} />);
    fireEvent.click(screen.getByText("Shopping mall"));
    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
  });

  it("shows disabled info modal when pipe has children", () => {
    const childrenMap = new Map<Id<"pipes">, any[]>();
    childrenMap.set(pipeInfo.id, [{ _id: "child1" as Id<"pipes"> }]);

    mockUsePipeSelection.mockReturnValue({
      pipesById: { [pipeInfo.id]: pipeInfo },
      childrenByParent: childrenMap,
    });

    render(<TransactionItem transaction={baseTx} />);
    fireEvent.click(screen.getByText("Shopping mall"));
    expect(screen.getByText("Cannot repeat transaction")).toBeDefined();
    expect(screen.getByText(/cannot accept transactions anymore/)).toBeDefined();
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
    const tx = { ...transferTx, value: 100 };
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
      pipesById: { [feedPipeInfo._id]: feedPipeInfo },
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
    expect(screen.getByText("1000.00")).toBeDefined();
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
