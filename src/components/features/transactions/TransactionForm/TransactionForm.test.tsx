// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import { AmountForm } from "@features/components/AmountForm";
import { colors } from "@/lib/styles";
import { TransactionForm } from "./TransactionForm";

const root: PipeModel = { id: "root" as Id<"pipes">, name: "Budget", icon: "pipe", fed: 10000, spent: 0, capacity: 0, priority: 0 };
const source: PipeModel = { ...root, id: "source" as Id<"pipes">, parentId: root.id, name: "Food", fed: 1000, spent: 1000, capacity: 2000 };
const other: PipeModel = { ...root, id: "other" as Id<"pipes">, name: "Wallet", fed: 2000, spent: 500, capacity: 2000 };
const create = vi.fn().mockResolvedValue(undefined);
const edit = vi.fn().mockResolvedValue(undefined);
const history = vi.fn(() => ({ transactions: [], isLoading: false }));
vi.mock("convex/react", () => ({ useMutation: (api: string) => api === "edit" ? edit : create, useQuery: () => [] }));
vi.mock("@convex/_generated/api", () => ({ api: { transactions: { createTransaction: "create", editTransaction: "edit", listRecentTitles: "titles" } } }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ error: vi.fn() }) }));
vi.mock("@features/transactions/cache/TransactionCacheContext", () => ({ useOptionalTransactionCache: () => null }));
vi.mock("@features/transactions/cache/useTransactionHistory", () => ({ useTransactionHistory: () => history() }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({
  allPipes: [root, source, other], childrenByParent: new Map([[root.id, [source]]]), isLoading: false,
  pipesById: { [root.id]: root, [source.id]: source, [other.id]: other },
}) }));

const initial = {
  transactionId: "tx" as Id<"transactions">, date: Date.UTC(2025, 1, 3),
  pipeName: source.name, pipeIcon: source.icon, title: "Lunch", value: "-5.00",
  structure: { type: "payByTransfer" as const, from: source.id, paidFrom: other.id },
};

describe("transaction forms", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts repeat on details with its payer visible, and clears an incompatible payer when changing source", async () => {
    render(<TransactionForm pipeId={source.id} initState={{ ...initial, intent: "repeat" }} />);
    expect(screen.getByText("repeat")).toBeTruthy();
    expect(screen.getByDisplayValue("Lunch")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Paid from" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    const selected = screen.getByRole("radio", { name: /Food/ });
    expect(selected.getAttribute("aria-checked")).toBe("true");
    const expected = document.createElement("div");
    expected.style.color = colors.error;
    expect(getComputedStyle(selected).borderTopColor).toBe(expected.style.color);
    fireEvent.click(screen.getByRole("radio", { name: /Wallet/ }));
    expect(screen.getByDisplayValue("Lunch")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Paid from" }).textContent).toBe("None");
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ from: other.id, title: "Lunch", value: -500 })));
    expect(create.mock.calls[0][0]).not.toHaveProperty("paidFrom");
  });

  it("opens edit on details and preserves the draft when changing the primary pipe", async () => {
    render(<TransactionForm pipeId={source.id} initState={{ ...initial, intent: "edit", structure: { type: "expense", from: source.id } }} />);
    expect(screen.getByRole("heading", { name: "Edit: Food Lunch" })).toBeTruthy();
    expect(screen.getByText("edit")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), { target: { value: "Dinner" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("radio", { name: /Wallet/ }));
    expect(screen.getByDisplayValue("Dinner")).toBeTruthy();
    expect(screen.getByText(/Food: spent/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Update transaction" }));
    await waitFor(() => expect(edit).toHaveBeenCalledWith(expect.objectContaining({ transactionId: initial.transactionId, primaryPipeId: other.id, title: "Dinner", value: -500, date: initial.date })));
  });

  it("requires selection and an accounting choice when the old primary pipe is missing", async () => {
    render(<TransactionForm pipeId={undefined} initState={{ ...initial, intent: "edit", pipeName: "Deleted", structure: { type: "expense", from: "deleted" as Id<"pipes"> } }} />);
    expect(screen.getByRole("heading", { name: "Select pipe" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Food/ }));
    expect(screen.getByText(/replacement/)).toBeTruthy();
    expect(screen.getByText(/no accounting update/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Update transaction" }));
    await waitFor(() => expect(edit).toHaveBeenCalledWith(expect.objectContaining({ primaryPipeId: source.id, applyReplacementEffects: false })));
  });

  it("shows the accounting effect on a replacement pipe when toggled on", () => {
    render(<TransactionForm pipeId={undefined} initState={{ ...initial, intent: "edit", structure: { type: "expense", from: "deleted" as Id<"pipes"> } }} />);
    fireEvent.click(screen.getByRole("radio", { name: /Food/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Apply accounting to replacement pipes" }));
    expect(screen.getByText(/Food: spent \+5.00/)).toBeTruthy();
    expect(screen.getByText(/Replacement pipes receive the transaction effect/)).toBeTruthy();
  });

  it("renders embedded spending without a pipe header and resets disclosure through mode changes and Clear", () => {
    render(<AmountForm pipeId={source.id} variant="spend" />);
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), { target: { value: "Coffee" } });
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByTestId("form-pager")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Paid from another pipe?" }));
    expect(screen.getByRole("button", { name: "Paid from" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Transfer" }));
    expect(screen.queryByRole("button", { name: "Paid from" })).toBeNull();
    expect(screen.getByRole("button", { name: "Transfer to" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Spend" }));
    fireEvent.click(screen.getByRole("button", { name: "Paid from another pipe?" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear form" }));
    expect(screen.getByRole("button", { name: "Paid from another pipe?" })).toBeTruthy();
    expect((screen.getByPlaceholderText("What was this for?") as HTMLInputElement).value).toBe("");
  });

  it("repeats a feed with root destinations and no spend/transfer toggle", async () => {
    render(<TransactionForm pipeId={other.id} initState={{ ...initial, pipeName: other.name, value: "5.00", structure: { type: "feed", to: other.id }, intent: "repeat" }} />);
    expect(screen.queryByRole("radio", { name: "Spend" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("radio", { name: /Food/ })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Budget/ }));
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ to: root.id, value: 500 })));
    expect(create.mock.calls[0][0]).not.toHaveProperty("from");
  });
});
