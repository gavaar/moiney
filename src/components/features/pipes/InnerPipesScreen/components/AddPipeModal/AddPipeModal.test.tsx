// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render as renderComponent, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { ConfirmModalProvider } from "@ui/ConfirmModal";
import type { Id } from "@convex/_generated/dataModel";
import { AddPipeModal } from "./AddPipeModal";
import type { PipeModel } from "@features/pipes/data/pipes";

vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useOptionalEventHistoryCache: () => null }));
const addPipe = vi.fn().mockResolvedValue(undefined);
vi.mock("convex/react", () => ({ useMutation: () => addPipe }));
vi.mock("@convex/_generated/api", () => ({ api: { pipes: { addPipe: "add" } } }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => catalog }));
const parentId = "parent-1" as Id<"pipes">;
const otherId = "parent-2" as Id<"pipes">;
const owner: PipeModel = { id: parentId, name: "Wallet", icon: "wallet-outline", priority: 0, capacity: 10000, spent: 2000, fed: 8000 };
const other: PipeModel = { ...owner, id: otherId, name: "Savings", icon: "pipe", capacity: 0, spent: 0, sourceType: "boiler" };
const nested: PipeModel = { ...owner, id: "child" as Id<"pipes">, parentId: otherId, name: "Nested" };
let catalog: { allPipes: PipeModel[] | undefined; isLoading: boolean };
const onClose = vi.fn();
function render(element: ReactNode) { return renderComponent(element, { wrapper: ConfirmModalProvider }); }
function click(name: string) { fireEvent.click(screen.getByRole("button", { name })); }
function fill(name: string, value: string) { fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } }); }
function renderModal(selected?: string) {
  const rendered = render(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
  if (selected) click(selected);
  return rendered;
}
function details(kind = "Manual") { const rendered = renderModal(kind); click("Next step"); return rendered; }

describe("contextual child creation", () => {
  beforeEach(() => { vi.clearAllMocks(); addPipe.mockResolvedValue(undefined); catalog = { allPipes: [owner, other, nested], isLoading: false }; });
  afterEach(() => vi.useRealTimers());

  it("starts Add child pipe with the unselected picker open and retains its contextual owner", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Pipe type" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Basic feed" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Boiler" }).getAttribute("aria-disabled")).toBe("true");
    click("Manual"); expect(screen.getByRole("button", { name: "Owner pipe" }).textContent).toContain("Wallet");
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  });

  it("dismisses individual owner warnings until the modal is reopened", () => {
    catalog.allPipes = [{ ...owner, rule: "cron" }, other];
    const { rerender } = renderModal("Manual");
    const warning = screen.getByText(/current rule and options will be removed/);
    fireEvent.click(within(warning.parentElement!).getByRole("button", { name: "Dismiss warning" }));
    click("Next step"); expect(screen.queryByText(/current rule and options will be removed/)).toBeNull();
    expect(screen.getByText(/turns Wallet into an intermediate pipe/)).toBeTruthy();
    rerender(<AddPipeModal visible={false} onClose={onClose} parentId={parentId} />);
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />); click("Manual");
    expect(screen.getByText(/current rule and options will be removed/)).toBeTruthy();
  });

  it("offers future-child contingency and submits atomically from the owner page without Run now", async () => {
    const reserve = { ...other, id: "reserve" as Id<"pipes">, parentId };
    catalog.allPipes = [owner, reserve]; details(); fill("Name", "Food");
    click("Contingency"); click("Savings"); click("Previous step");
    expect(screen.queryByRole("button", { name: "Run now" })).toBeNull();
    click("Submit"); await waitFor(() => expect(addPipe).toHaveBeenCalledWith(expect.objectContaining({ contingencyPipeId: reserve.id })));
  });

  it("asks before abandoning creation and retains the draft on cancel", () => {
    details(); fill("Name", "Food"); fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.getByText("Discard changes?")).toBeTruthy(); click("Keep editing");
    expect(onClose).not.toHaveBeenCalled(); expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Food");
  });

  it("clears an unfinished pipe, retains its owner, and returns to type selection", () => {
    details(); fill("Name", "Groceries"); fill("Initial capacity?", "12.34"); click("Clear form");
    expect(screen.getByRole("button", { name: "Manual" })).toBeTruthy();
    click("Manual"); expect(screen.getByRole("button", { name: "Owner pipe" }).textContent).toContain("Wallet");
    click("Next step"); expect(screen.getByLabelText("Name").getAttribute("value")).toBe(""); expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the topology and accounting warnings on both pages", () => {
    renderModal("Manual"); expect(screen.getByText(/turns Wallet into an intermediate pipe/)).toBeTruthy();
    click("Next step"); expect(screen.getByText(/local capacity and spending are cleared/)).toBeTruthy();
    click("Previous step"); expect(screen.getByText(/turns Wallet into an intermediate pipe/)).toBeTruthy();
  });

  it("validates the destruct date and preserves it while navigating before atomic submission", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.UTC(2026, 8, 20, 18));
    details("Self-destruct"); fill("Name", "Madrid");
    click("Destruct date"); fireEvent.click(screen.getByTestId("day-20"));
    expect(screen.getByText("Choose a future deletion date (05:00 UTC)")).toBeTruthy();
    click("Destruct date"); fireEvent.click(screen.getByTestId("day-21"));
    click("Previous step"); click("Next step"); click("Submit");
    await waitFor(() => expect(addPipe).toHaveBeenCalledWith(expect.objectContaining({
      name: "Madrid", parentId, ruleConfig: { rule: "self_destruct", starting: Date.UTC(2026, 8, 21, 5) },
    })));
  });

  it("revalidates a destruct deadline while its form remains open", () => {
    vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2026, 8, 21, 4, 59));
    details("Self-destruct"); fill("Name", "Madrid"); click("Destruct date"); fireEvent.click(screen.getByTestId("day-21"));
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).not.toBe("true");
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("requires an explicit type rather than silently defaulting to Manual", () => {
    renderModal(); expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    expect(addPipe).not.toHaveBeenCalled();
  });

  it("selects an owner without auto-advancing and preserves it on return", () => {
    render(<AddPipeModal visible onClose={onClose} />); click("Manual"); click("Owner pipe"); click("Wallet");
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    click("Next step"); click("Previous step");
    expect(screen.getByRole("button", { name: "Owner pipe" }).textContent).toContain("Wallet");
  });

  it("preserves details when changing owner and submits signed capacity to the new owner", async () => {
    details(); fill("Name", "Food"); click("Previous step"); click("Owner pipe"); click("Savings"); click("Next step");
    expect(screen.getByDisplayValue("Food")).toBeTruthy(); expect(screen.queryByText(/turns Savings/)).toBeNull();
    fill("Initial capacity?", "-12.34"); click("Submit");
    await waitFor(() => expect(addPipe).toHaveBeenCalledWith(expect.objectContaining({ name: "Food", parentId: otherId, capacity: -1234 })));
  });

  it("rejects an incomplete signed capacity", () => {
    details(); fill("Name", "Food"); fill("Initial capacity?", "-"); fireEvent.blur(screen.getByLabelText("Initial capacity?"));
    expect(screen.getByText("Enter a valid capacity")).toBeTruthy(); click("Submit"); expect(addPipe).not.toHaveBeenCalled();
  });

  it("shows loading owner feedback and excludes deleting owners", () => {
    const { rerender } = renderModal("Manual"); catalog.isLoading = true;
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
    expect(screen.getByLabelText("Loading Owner pipe")).toBeTruthy();
    catalog.isLoading = false; catalog.allPipes = [{ ...owner, deletionJobId: "job" as Id<"pipeDeletionJobs"> }, other];
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />); click("Owner pipe");
    expect(screen.queryByRole("button", { name: "Wallet" })).toBeNull(); expect(screen.getByRole("button", { name: "Savings" })).toBeTruthy();
  });

  it("cannot submit without an owner even after filling the details", () => {
    render(<AddPipeModal visible onClose={onClose} />); click("Manual"); click("Next step"); fill("Name", "Food");
    click("Submit"); expect(addPipe).not.toHaveBeenCalled();
  });

  it("disables submission if the selected owner becomes unavailable", () => {
    const { rerender } = details(); fill("Name", "Food"); catalog.allPipes = [other];
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("resets owner, navigation, values and validation when reopened", () => {
    const { rerender } = details(); fill("Name", "a"); fireEvent.blur(screen.getByLabelText("Name"));
    click("Previous step"); click("Owner pipe"); click("Savings");
    rerender(<AddPipeModal visible={false} onClose={onClose} parentId={parentId} />);
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />); click("Manual");
    expect(screen.getByRole("button", { name: "Owner pipe" }).textContent).toContain("Wallet");
    click("Next step"); expect(screen.getByLabelText("Name").getAttribute("value")).toBe("");
    expect(screen.queryByText("Name must be at least 3 characters")).toBeNull();
  });

  it.each([["0", 0], ["12.34", 1234]] as const)("submits capacity %s as integer cents", async (capacity, cents) => {
    details(); fill("Name", " Food "); fill("Description", "Lunch budget"); click("Increase Priority"); fill("Initial capacity?", capacity); click("Submit");
    await waitFor(() => expect(addPipe).toHaveBeenCalledExactlyOnceWith({ parentId, name: "Food", description: "Lunch budget", icon: "pipe", priority: 1, capacity: cents }));
  });

  it("renders nothing when not visible", () => {
    render(<AddPipeModal visible={false} onClose={onClose} parentId={parentId} />);
    expect(screen.queryByRole("button", { name: "Pipe type" })).toBeNull();
  });
  it("renders the requested grouped detail inputs on the second page", () => {
    details(); for (const label of ["Name", "Description", "Priority", "Initial capacity?"]) expect(screen.getByRole("textbox", { name: label })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Icon" })).toBeTruthy(); expect(screen.getByLabelText("Step 2 of 2").getAttribute("aria-selected")).toBe("true");
  });
  it.each([["", "Name is required"], ["ab", "Name must be at least 3 characters"]])("validates the name draft %s on blur", (value, error) => {
    details(); fill("Name", value); expect(screen.queryByText(error)).toBeNull(); fireEvent.blur(screen.getByLabelText("Name"));
    expect(screen.getByText(error)).toBeTruthy(); click("Submit"); expect(addPipe).not.toHaveBeenCalled();
  });
  it("keeps errors visible through invalid corrections and clears them when valid", () => {
    details(); fireEvent.blur(screen.getByLabelText("Name")); fill("Name", "a");
    expect(screen.getByText("Name must be at least 3 characters")).toBeTruthy(); fill("Name", "abc"); expect(screen.queryByText("Name must be at least 3 characters")).toBeNull();
  });
  it("submits blank capacity as zero with the default pipe icon", async () => {
    details(); fill("Name", "Food"); click("Submit");
    await waitFor(() => expect(addPipe).toHaveBeenCalledWith({ name: "Food", icon: "pipe", description: undefined, priority: 0, capacity: 0, parentId }));
  });
  it("keeps a failed submission error separate from dismissible warnings", async () => {
    addPipe.mockRejectedValueOnce(new Error("Server error")); details(); fill("Name", "Food"); click("Submit");
    await waitFor(() => expect(screen.getByText("Server error")).toBeTruthy());
    for (const dismiss of screen.getAllByRole("button", { name: "Dismiss warning" })) fireEvent.click(dismiss);
    expect(screen.getByRole("alert").textContent).toBe("Server error");
  });
  it("blocks repeated submissions and clearing while saving", async () => {
    let finish!: () => void; addPipe.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    details(); fill("Name", "Food"); click("Submit"); click("Submit"); expect(addPipe).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Clear form" }).getAttribute("aria-disabled")).toBe("true");
    await act(async () => finish()); expect(onClose).toHaveBeenCalledOnce();
  });
  it("closes and validates the empty picker before allowing backdrop dismissal", () => {
    renderModal(); fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Pipe type is required");
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
