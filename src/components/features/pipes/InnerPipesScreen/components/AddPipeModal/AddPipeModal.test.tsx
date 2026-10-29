// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render as renderComponent, screen, waitFor } from "@testing-library/react";
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
function acknowledgeWarnings() {
  click("Next step"); click("Next step");
  fireEvent.click(screen.getByRole("checkbox", { name: "I understand" }));
}
function renderModal(selected?: string) {
  const rendered = render(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
  if (selected) click(selected);
  return rendered;
}

describe("contextual child creation", () => {
  beforeEach(() => { vi.clearAllMocks(); addPipe.mockResolvedValue(undefined); catalog = { allPipes: [owner, other, nested], isLoading: false }; });
  afterEach(() => vi.useRealTimers());

  it("starts Add child pipe with the unselected picker open and retains its contextual owner", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Pipe type" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Basic feed" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Boiler" }).getAttribute("aria-disabled")).toBe("true");
    click("Manual"); expect(screen.getByRole("button", { name: "Owner pipe" }).textContent).toContain("Wallet");
    expect(screen.getByRole("button", { name: "Pipe type" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });

  it("puts non-dismissible owner warnings on a conditional third page without advancing", () => {
    catalog.allPipes = [{ ...owner, rule: "cron" }, other, nested];
    renderModal("Manual");
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    expect(screen.getByLabelText("Step 1 of 3").getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("alert")).toBeNull();
    click("Next step");
    expect(screen.queryByRole("alert")).toBeNull();
    click("Next step");
    expect(screen.getAllByRole("alert").some(warning => warning.textContent?.includes("lose its ability to record expenses"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Dismiss warning" })).toBeNull();
    const checkbox = screen.getByRole("checkbox", { name: "I understand" });
    for (const warning of screen.getAllByRole("alert")) {
      expect(warning.compareDocumentPosition(checkbox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    click("Previous step"); click("Previous step");
    click("Owner pipe"); click("Savings");
    // Savings already has a child, so no transition warnings are needed.
    expect(screen.getByLabelText("Step 1 of 2")).toBeTruthy();
  });

  it("offers future-child contingency and submits atomically from the owner page without Run now", async () => {
    const reserve = { ...other, id: "reserve" as Id<"pipes">, parentId };
    catalog.allPipes = [owner, reserve]; renderModal("Manual"); fill("Name", "Food"); click("Next step");
    click("Contingency"); click("Savings"); click("Previous step");
    expect(screen.queryByRole("button", { name: "Run now" })).toBeNull();
    click("Submit"); await waitFor(() => expect(addPipe).toHaveBeenCalledWith(expect.objectContaining({ contingencyPipeId: reserve.id })));
  });

  it("requires acknowledgement on every page and permits submission from an earlier page once checked", async () => {
    renderModal("Manual"); fill("Name", "Food");
    const submitDisabled = () => screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled");
    expect(submitDisabled()).toBe("true"); click("Submit");
    expect(addPipe).not.toHaveBeenCalled();
    click("Next step"); expect(submitDisabled()).toBe("true");
    click("Next step"); expect(submitDisabled()).toBe("true");
    const checkbox = screen.getByRole("checkbox", { name: "I understand" });
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(checkbox); expect(submitDisabled()).not.toBe("true");
    fireEvent.click(checkbox); expect(submitDisabled()).toBe("true");
    expect(screen.getAllByRole("alert")).toHaveLength(3);
    fireEvent.click(checkbox);
    click("Previous step"); fill("Description", "Groceries"); click("Previous step");
    fill("Name", "Food budget"); expect(submitDisabled()).not.toBe("true");
    click("Submit");
    await waitFor(() => expect(addPipe).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: "Food budget", description: "Groceries", parentId })));
    expect(addPipe.mock.calls[0][0]).not.toHaveProperty("warningsAcknowledged");
  });

  it("forgets acknowledgement on owner changes, including switching back", () => {
    catalog.allPipes = [owner, other];
    renderModal("Manual"); fill("Name", "Food"); acknowledgeWarnings();
    click("Previous step"); click("Previous step");
    click("Owner pipe"); click("Savings");
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    click("Owner pipe"); click("Wallet");
    click("Next step"); click("Next step");
    expect(screen.getByRole("checkbox", { name: "I understand" }).getAttribute("aria-checked")).toBe("false");
  });

  it("forgets acknowledgement when live warnings change but not on unrelated live balances", () => {
    catalog.allPipes = [{ ...owner, parentId: otherId }, other, nested];
    const { rerender } = renderModal("Manual"); fill("Name", "Food"); acknowledgeWarnings();
    catalog.allPipes = catalog.allPipes.map(pipe => ({ ...pipe, fed: pipe.fed + 100 }));
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
    expect(screen.getByRole("checkbox", { name: "I understand" }).getAttribute("aria-checked")).toBe("true");
    catalog.allPipes = catalog.allPipes.map(pipe => pipe.id === nested.id ? { ...pipe, contingencyPipeId: parentId } : pipe);
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
    expect(screen.getByRole("checkbox", { name: "I understand" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getAllByRole("alert").some(warning => warning.textContent?.includes("won't protect 'Nested' anymore"))).toBe(true);
    catalog.allPipes = catalog.allPipes.map(pipe => ({ ...pipe, contingencyPipeId: undefined }));
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
    expect(screen.getByRole("checkbox", { name: "I understand" }).getAttribute("aria-checked")).toBe("false");
  });

  it.each(["clear", "reopen"])("forgets acknowledgement after %s", method => {
    const { rerender } = renderModal("Manual"); fill("Name", "Food"); acknowledgeWarnings();
    if (method === "clear") click("Clear form");
    else {
      rerender(<AddPipeModal visible={false} onClose={onClose} parentId={parentId} />);
      rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
    }
    click("Manual"); fill("Name", "Food");
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    click("Next step"); click("Next step");
    expect(screen.getByRole("checkbox", { name: "I understand" }).getAttribute("aria-checked")).toBe("false");
  });

  it("drops a vanished warning page and does not jump back if live warnings return", () => {
    const { rerender } = renderModal("Manual"); fill("Name", "Food"); acknowledgeWarnings();
    catalog.allPipes = [owner, other, nested, { ...nested, id: "new-child" as Id<"pipes">, parentId }];
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
    expect(screen.getByLabelText("Step 1 of 2").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("value")).toBe("Food");
    catalog.allPipes = [owner, other, nested];
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
    expect(screen.getByLabelText("Step 1 of 3").getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("checkbox", { name: "I understand" })).toBeNull();
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    click("Next step"); click("Next step");
    expect(screen.getByRole("checkbox", { name: "I understand" }).getAttribute("aria-checked")).toBe("false");
  });

  it("asks before abandoning creation and retains the draft on cancel", () => {
    renderModal("Manual"); fill("Name", "Food"); fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.getByText("Discard changes?")).toBeTruthy(); click("Keep editing");
    expect(onClose).not.toHaveBeenCalled(); expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Food");
  });

  it("clears an unfinished pipe, retains its owner, and returns to type selection", () => {
    renderModal("Manual"); fill("Name", "Groceries"); fill("Starting capacity?", "12.34"); click("Clear form");
    expect(screen.getByRole("button", { name: "Manual" })).toBeTruthy();
    click("Manual"); expect(screen.getByRole("button", { name: "Owner pipe" }).textContent).toContain("Wallet");
    expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("value")).toBe(""); expect(onClose).not.toHaveBeenCalled();
  });

  it("validates the destruct date and preserves it while navigating before atomic submission", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.UTC(2026, 8, 20, 18));
    renderModal("Self-destruct"); fill("Name", "Madrid"); click("Next step");
    click("Destruct date"); fireEvent.click(screen.getByTestId("day-20"));
    expect(screen.getByText("Choose a future deletion date (05:00 UTC)")).toBeTruthy();
    click("Destruct date"); fireEvent.click(screen.getByTestId("day-21"));
    click("Previous step"); click("Next step"); click("Next step");
    fireEvent.click(screen.getByRole("checkbox", { name: "I understand" })); click("Submit");
    await waitFor(() => expect(addPipe).toHaveBeenCalledWith(expect.objectContaining({
      name: "Madrid", parentId, ruleConfig: { rule: "self_destruct", starting: Date.UTC(2026, 8, 21, 5) },
    })));
  });

  it("revalidates a destruct deadline while its form remains open", () => {
    vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2026, 8, 21, 4, 59));
    renderModal("Self-destruct"); fill("Name", "Madrid"); click("Next step"); click("Destruct date"); fireEvent.click(screen.getByTestId("day-21"));
    click("Next step"); fireEvent.click(screen.getByRole("checkbox", { name: "I understand" }));
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
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    click("Next step"); click("Previous step");
    expect(screen.getByRole("button", { name: "Owner pipe" }).textContent).toContain("Wallet");
  });

  it("preserves details when changing owner and submits signed capacity to the new owner", async () => {
    renderModal("Manual"); fill("Name", "Food"); click("Owner pipe"); click("Savings");
    expect(screen.getByDisplayValue("Food")).toBeTruthy(); expect(screen.queryByText(/turns 'Savings'/)).toBeNull();
    fill("Starting capacity?", "-12.34"); click("Submit");
    await waitFor(() => expect(addPipe).toHaveBeenCalledWith(expect.objectContaining({ name: "Food", parentId: otherId, capacity: -1234 })));
  });

  it("rejects an incomplete signed capacity", () => {
    renderModal("Manual"); fill("Name", "Food"); fill("Starting capacity?", "-"); fireEvent.blur(screen.getByLabelText("Starting capacity?"));
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
    render(<AddPipeModal visible onClose={onClose} />); click("Manual"); fill("Name", "Food");
    click("Submit"); expect(addPipe).not.toHaveBeenCalled();
  });

  it("disables submission if the selected owner becomes unavailable", () => {
    const { rerender } = renderModal("Manual"); fill("Name", "Food"); catalog.allPipes = [other];
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("resets owner, navigation, values and validation when reopened", () => {
    const { rerender } = renderModal("Manual"); fill("Name", "a"); fireEvent.blur(screen.getByLabelText("Name"));
    click("Owner pipe"); click("Savings");
    rerender(<AddPipeModal visible={false} onClose={onClose} parentId={parentId} />);
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />); click("Manual");
    expect(screen.getByRole("button", { name: "Owner pipe" }).textContent).toContain("Wallet");
    expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("value")).toBe("");
    expect(screen.queryByText("Name must be at least 3 characters")).toBeNull();
  });

  it.each([["0", 0], ["12.34", 1234]] as const)("submits capacity %s as integer cents", async (capacity, cents) => {
    renderModal("Manual"); fill("Name", " Food "); click("Increase Priority"); fill("Starting capacity?", capacity);
    click("Next step"); fill("Description", "Lunch budget"); click("Next step");
    fireEvent.click(screen.getByRole("checkbox", { name: "I understand" })); click("Submit");
    await waitFor(() => expect(addPipe).toHaveBeenCalledExactlyOnceWith({ parentId, name: "Food", description: "Lunch budget", icon: "valve", priority: 1, capacity: cents }));
  });

  it("renders nothing when not visible", () => {
    render(<AddPipeModal visible={false} onClose={onClose} parentId={parentId} />);
    expect(screen.queryByRole("button", { name: "Pipe type" })).toBeNull();
  });
  it("keeps the common inputs on the first page and additional settings on the second", () => {
    renderModal("Manual"); for (const label of ["Name", "Priority", "Starting capacity?"]) expect(screen.getByRole("textbox", { name: label })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Icon" })).toBeTruthy(); expect(screen.getByLabelText("Step 1 of 3").getAttribute("aria-selected")).toBe("true");
    click("Next step");
    expect(screen.getByRole("textbox", { name: "Description" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Contingency" })).toBeTruthy();
  });
  it.each([["", "Name is required"], ["ab", "Name must be at least 3 characters"]])("validates the name draft %s on blur", (value, error) => {
    renderModal("Manual"); fill("Name", value); expect(screen.queryByText(error)).toBeNull(); fireEvent.blur(screen.getByLabelText("Name"));
    expect(screen.getByText(error)).toBeTruthy(); click("Submit"); expect(addPipe).not.toHaveBeenCalled();
  });
  it("keeps errors visible through invalid corrections and clears them when valid", () => {
    renderModal("Manual"); fireEvent.blur(screen.getByLabelText("Name")); fill("Name", "a");
    expect(screen.getByText("Name must be at least 3 characters")).toBeTruthy(); fill("Name", "abc"); expect(screen.queryByText("Name must be at least 3 characters")).toBeNull();
  });
  it("submits blank capacity as zero with the selected type's default icon", async () => {
    renderModal("Manual"); fill("Name", "Food"); acknowledgeWarnings(); click("Submit");
    await waitFor(() => expect(addPipe).toHaveBeenCalledWith({ name: "Food", icon: "valve", description: undefined, priority: 0, capacity: 0, parentId }));
  });
  it("keeps a failed submission error and acknowledged warnings visible without dismissal", async () => {
    addPipe.mockRejectedValueOnce(new Error("Server error")); renderModal("Manual"); fill("Name", "Food"); acknowledgeWarnings(); click("Submit");
    await waitFor(() => expect(screen.getByText("Server error")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Dismiss warning" })).toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(4);
    click("Previous step");
    expect(screen.getByRole("alert").textContent).toBe("Server error");
  });
  it("blocks repeated submissions and clearing while saving", async () => {
    let finish!: () => void; addPipe.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    renderModal("Manual"); fill("Name", "Food"); acknowledgeWarnings(); click("Submit"); click("Submit"); expect(addPipe).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Clear form" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("checkbox", { name: "I understand" }).getAttribute("aria-disabled")).toBe("true");
    await act(async () => finish()); expect(onClose).toHaveBeenCalledOnce();
  });
  it("closes and validates the empty picker before allowing backdrop dismissal", () => {
    renderModal(); fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert", { name: "Pipe type required" }).textContent).toBe("Pipe type required");
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
