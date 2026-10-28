// @vitest-environment jsdom
import { act, fireEvent, render as renderComponent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ConfirmModalProvider } from "@ui/ConfirmModal";
import { OptionListHost } from "@ui/OptionList";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { CreateModal } from "./CreateModal";

function render(element: ReactNode) {
  return renderComponent(element, { wrapper: ({ children }) => <OptionListHost><ConfirmModalProvider>{children}</ConfirmModalProvider></OptionListHost> });
}
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
const onClose = vi.fn();
const createTransaction = vi.fn().mockResolvedValue(undefined);
const addPipe = vi.fn().mockResolvedValue(undefined);
const addFeed = vi.fn().mockResolvedValue(undefined);
vi.mock("convex/react", () => ({ useMutation: (name: string) => name === "addPipe" ? addPipe : name === "addFeed" ? addFeed : createTransaction, useQuery: () => [] }));
vi.mock("@convex/_generated/api", () => ({ api: { financialOperations: { edit: {}, create: {}, contributeToBoiler: {} }, transactions: { listRecentTitles: {} }, pipes: { addPipe: "addPipe", addFeed: "addFeed" } } }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useOptionalEventHistoryCache: () => null }));
const pipe1 = { id: "pipe-1" as Id<"pipes">, name: "Groceries", icon: "cart", priority: 1, capacity: 50000, fed: 30000, spent: 12345 };
const pipe2 = { id: "pipe-2" as Id<"pipes">, name: "Transport", icon: "car", priority: 2, capacity: 20000, fed: 15000, spent: 5000 };
vi.mock("@features/transactions/cache/useEventHistory", () => ({
  useEventHistory: () => ({
    entries: [
      { id: "tx-1", operationId: "tx-1", pipeId: "pipe-2", type: "transaction", title: "lunch", value: -100, occurredAt: 3, createdAt: 3 },
      { id: "tx-2", operationId: "tx-2", pipeId: "pipe-1", type: "transaction", title: "lunch", value: -100, occurredAt: 2, createdAt: 2 },
      { id: "tx-3", operationId: "tx-3", pipeId: "pipe-2", type: "transaction", title: "lunch", value: -100, occurredAt: 1, createdAt: 1 },
    ],
    isLoading: false,
  }),
}));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({
    allPipes: [pipe1, pipe2], pipesById: { [pipe1.id]: pipe1, [pipe2.id]: pipe2 }, childrenByParent: new Map(), isLoading: false,
  }),
}));
vi.mock("@ui/Modal", () => ({
  ModalShell: ({ children, bottomAccessory, onClose: close, visible }: any) => visible ?
    <div><button onClick={close}>Backdrop</button>{children}{bottomAccessory}</div> : null,
}));
vi.mock("@ui/Icon", async importOriginal => ({ ...await importOriginal<typeof import("@ui/Icon")>(), Icon: () => null }));

function click(name: string) { fireEvent.click(screen.getByRole("button", { name })); }
function mode(name: "transaction" | "pipe") { fireEvent.click(screen.getByRole("tab", { name })); }
function fill(name: string, value: string) { fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } }); }
function acknowledgeWarnings() {
  click("Next step"); click("Next step");
  fireEvent.click(screen.getByRole("checkbox", { name: "I understand" }));
}
type Scenario = "transaction" | "inner" | "feed";
function prepare(scenario: Scenario) {
  mode(scenario === "transaction" ? "transaction" : "pipe");
  if (scenario !== "transaction") click("Pipe type");
  if (scenario === "feed") { click("Basic feed"); fill("Name", "Savings"); return; }
  if (scenario === "inner") click("Manual");
  click(scenario === "inner" ? "Owner pipe" : "Transaction pipe");
  fireEvent.click(screen.getByRole("button", { name: /Groceries/ }));
  if (scenario === "inner") fill("Name", "Lunch");
  else {
    click("Next step");
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), { target: { value: "Lunch" } });
  }
}

describe("CreateModal", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("offers only transaction and pipe modes without leaking hidden overlays", () => {
    render(<CreateModal onClose={onClose} />);
    expect(screen.queryByRole("tab", { name: "root" })).toBeNull(); expect(screen.queryByRole("button", { name: "Basic feed" })).toBeNull();
    mode("pipe"); click("Pipe type"); expect(screen.getByRole("button", { name: "Basic feed" })).toBeTruthy();
    mode("transaction"); expect(screen.queryByRole("button", { name: "Basic feed" })).toBeNull();
  });
  it("closes untouched drafts without confirmation", () => {
    render(<CreateModal onClose={onClose} />); click("Backdrop"); expect(onClose).toHaveBeenCalledOnce(); expect(screen.queryByText("Discard changes?")).toBeNull();
  });
  it.each(["transaction", "feed"] as const)("clearing the %s draft removes its discard warning", scenario => {
    render(<CreateModal onClose={onClose} />); prepare(scenario); click("Clear form"); click("Backdrop");
    expect(onClose).toHaveBeenCalledOnce(); expect(screen.queryByText("Discard changes?")).toBeNull();
  });
  it("clearing a pipe draft does not forget a hidden transaction draft", () => {
    render(<CreateModal onClose={onClose} />); prepare("transaction"); prepare("feed"); click("Clear form"); click("Backdrop");
    expect(screen.getByText("Discard changes?")).toBeTruthy(); expect(onClose).not.toHaveBeenCalled();
  });
  it.each(["transaction", "inner", "feed"] as const)("blocks dismissal while a hidden %s submission is saving", async scenario => {
    let finish!: () => void;
    const mutation = scenario === "transaction" ? createTransaction : scenario === "inner" ? addPipe : addFeed;
    mutation.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    render(<CreateModal onClose={onClose} />); prepare(scenario);
    if (scenario === "transaction") fill("Value", "5.00");
    if (scenario === "inner") acknowledgeWarnings();
    click(scenario === "transaction" ? "Add expense" : "Submit"); expect(mutation).toHaveBeenCalledOnce();
    mode(scenario === "transaction" ? "pipe" : "transaction"); click("Backdrop");
    expect(onClose).not.toHaveBeenCalled(); expect(screen.queryByText("Discard changes?")).toBeNull();
    await act(async () => finish()); expect(onClose).toHaveBeenCalledOnce();
  });
  it.each(["transaction", "inner", "feed"] as const)("protects a hidden %s draft and preserves it when discard is cancelled", async scenario => {
    render(<CreateModal onClose={onClose} />); prepare(scenario); mode(scenario === "transaction" ? "pipe" : "transaction");
    click("Backdrop"); expect(screen.getByText("Discard changes?")).toBeTruthy(); click("Keep editing");
    expect(onClose).not.toHaveBeenCalled(); mode(scenario === "transaction" ? "transaction" : "pipe");
    expect(screen.getByDisplayValue(scenario === "feed" ? "Savings" : "Lunch")).toBeTruthy();
    click("Backdrop"); click("Discard changes"); await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
  it("defaults to transaction and retains its values and page across mode switches", () => {
    render(<CreateModal onClose={onClose} />); expect(screen.getByRole("tab", { name: "transaction" }).getAttribute("aria-selected")).toBe("true");
    prepare("transaction"); mode("pipe"); expect(screen.getByRole("heading", { name: "Create pipe" })).toBeTruthy();
    mode("transaction"); expect(screen.getByDisplayValue("Lunch")).toBeTruthy(); expect(screen.getByRole("textbox", { name: "Value" })).toBeTruthy();
  });
  it("creates an inner pipe with the selected owner after preserving its draft across modes", async () => {
    render(<CreateModal onClose={onClose} />); prepare("inner"); fill("Starting capacity?", "12.34"); acknowledgeWarnings();
    mode("transaction"); mode("pipe");
    expect(screen.getByRole("checkbox", { name: "I understand" }).getAttribute("aria-checked")).toBe("true");
    click("Submit");
    await waitFor(() => expect(addPipe).toHaveBeenCalledWith(expect.objectContaining({ parentId: pipe1.id, name: "Lunch", capacity: 1234 })));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("only requires owner warnings for child creation and resets acknowledgement after switching to a feed", () => {
    render(<CreateModal onClose={onClose} />); mode("pipe");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "I understand" })).toBeNull();
    click("Pipe type"); click("Manual"); click("Owner pipe"); click("Groceries"); fill("Name", "Lunch");
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    acknowledgeWarnings(); click("Previous step"); click("Previous step");
    click("Pipe type"); click("Basic feed");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "I understand" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).not.toBe("true");
    click("Pipe type"); click("Manual");
    expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("value")).toBe("Lunch");
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    click("Next step"); click("Next step");
    expect(screen.getByRole("checkbox", { name: "I understand" }).getAttribute("aria-checked")).toBe("false");
  });
  it.each([false, true])("creates a root from Pipe mode (boiler=%s) with independent opening values", async boiler => {
    render(<CreateModal onClose={onClose} />); mode("pipe"); click("Pipe type"); click(boiler ? "Boiler" : "Basic feed"); fill("Name", "Savings");
    expect(screen.queryByRole("button", { name: "Icon" })).toBeNull(); fill("Initial amount", "12.34");
    if (boiler) fill("Contributed amount", "10.00");
    mode("transaction"); mode("pipe"); expect(screen.getByLabelText("Initial amount").getAttribute("value")).toBe("12.34"); click("Submit");
    await waitFor(() => expect(addFeed).toHaveBeenCalledExactlyOnceWith({
      name: "Savings",
      icon: boiler ? "boiler" : "feed-pipe",
      description: undefined,
      sourceType: boiler ? "boiler" : "feed",
      initialFed: 1234,
      ...(boiler ? { contributedFed: 1000 } : {}),
    }));
  });
  it("preserves transaction ranking and values when changing its selected pipe", async () => {
    render(<CreateModal onClose={onClose} />); click("Transaction pipe");
    const options = screen.getAllByRole("button", { name: /Transport|Groceries/ });
    expect(options.map(button => button.textContent)).toEqual(["Transport (50.00 / 200.00)", "Groceries (123.45 / 500.00)"]);
    fireEvent.click(options[0]); click("Next step");
    fireEvent.change(screen.getByPlaceholderText("What was this for?"), { target: { value: "Lunch" } }); fill("Value", "5.00");
    click("Previous step"); click("Transaction pipe"); fireEvent.click(screen.getByRole("button", { name: /Groceries/ })); click("Next step");
    expect(screen.getByDisplayValue("Lunch")).toBeTruthy(); click("Add expense");
    await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ title: "Lunch", value: -500, from: pipe1.id })));
  });
});
