// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddFeedButton } from "./AddFeedButton";
import { ConfirmModalProvider } from "@ui/ConfirmModal";
import { validateOpeningMoney } from "@features/pipes/PipeForm/pipe-form-policy";

const addFeed = vi.fn();
vi.mock("convex/react", () => ({ useMutation: () => addFeed }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@convex/_generated/api", () => ({ api: { pipes: { addFeed: "feed" } } }));
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useOptionalEventHistoryCache: () => null }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({ allPipes: [], isLoading: false }) }));

function click(name: string) { fireEvent.click(screen.getByRole("button", { name })); }
function fill(name: string, value: string) { fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } }); }
function finishAnimations() {
  document.querySelectorAll('[aria-modal="true"]').forEach(modal => {
    let node = modal.parentElement;
    while (node && node !== document.body) {
      fireEvent.animationEnd(node); fireEvent(node, new Event("webkitAnimationEnd", { bubbles: true })); node = node.parentElement;
    }
  });
}
function open(kind = "Basic feed") {
  render(<ConfirmModalProvider><AddFeedButton /></ConfirmModalProvider>);
  click("Add pipe");
  click(kind);
}

describe("root-list shared pipe creation", () => {
  beforeEach(() => { vi.clearAllMocks(); addFeed.mockResolvedValue(undefined); });

  it("starts Add pipe with the type picker open", () => {
    render(<ConfirmModalProvider><AddFeedButton /></ConfirmModalProvider>);
    click("Add pipe");
    expect(screen.getByRole("button", { name: "Pipe type" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Basic feed" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Boiler" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manual" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  });

  it.each(["backdrop", "Back"])("validates an empty picker on first %s and leaves a pristine draft on the next", async method => {
    render(<ConfirmModalProvider><AddFeedButton /></ConfirmModalProvider>);
    click("Add pipe"); finishAnimations();
    const dismiss = () => method === "backdrop"
      ? fireEvent.click(screen.getByTestId("modal-backdrop"))
      : fireEvent.keyUp(document, { key: "Escape" });
    expect(screen.queryByRole("alert")).toBeNull();
    dismiss();
    expect(screen.getByRole("alert").textContent).toBe("Pipe type required");
    expect(screen.getByRole("button", { name: "Pipe type" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Discard changes?")).toBeNull();
    dismiss();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Pipe type" })).toBeNull());
    expect(screen.queryByText("Discard changes?")).toBeNull();
    expect(addFeed).not.toHaveBeenCalled();
    click("Add pipe");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Pipe type" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("closes a reopened picker before asking to discard an edited draft", () => {
    open(); fill("Name", "Savings"); click("Pipe type");
    fireEvent.click(screen.getByTestId("collapsible-select-outside"));
    expect(screen.queryByText("Discard changes?")).toBeNull();
    expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Savings");
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.getByText("Discard changes?")).toBeTruthy();
    click("Keep editing"); finishAnimations();
    expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Savings");
  });

  it("keeps feed identity and opening values on the same page without an icon picker", () => {
    open();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Icon" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Initial amount" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Contributed amount" })).toBeNull();
  });

  it("clears values and validation and returns to an unselected picker without closing", () => {
    open("Boiler"); fill("Name", "a"); fireEvent.blur(screen.getByLabelText("Name"));
    fill("Initial amount", "12.34"); click("Clear form");
    expect(screen.getByRole("button", { name: "Pipe type" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Boiler" })).toBeTruthy();
    expect(screen.queryByText("Name must be at least 2 characters")).toBeNull();
    click("Boiler");
    expect(screen.getByLabelText("Name").getAttribute("value")).toBe("");
    expect(screen.getByLabelText("Initial amount").getAttribute("value")).toBe("");
  });

  it("validates names on blur and corrects their errors live", () => {
    open(); fill("Name", "a");
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(screen.getByLabelText("Name"));
    expect(screen.getByText("Name must be at least 2 characters")).toBeTruthy();
    click("Submit"); expect(addFeed).not.toHaveBeenCalled();
    fill("Name", "Savings");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).not.toBe("true");
  });

  it.each(["-0.01", "1.234", "abc", "1000000000.01", "9007199254740992"])("rejects invalid opening money %s", value => {
    expect(validateOpeningMoney(value)).toEqual(expect.any(String));
  });
  it.each(["", "0", "0.01", "123.45", "1000000000.00"])("accepts opening money %s", value => {
    expect(validateOpeningMoney(value)).toBeUndefined();
  });

  it.each([
    [false, "123.45", "", { initialFed: 12345 }],
    [false, "", "", {}],
    [true, "", "", {}],
    [true, "0", "100.01", { initialFed: 0, contributedFed: 10001 }],
    [true, "150.23", "100.12", { initialFed: 15023, contributedFed: 10012 }],
    [true, "", "9.99", { contributedFed: 999 }],
    [true, "9.99", "", { initialFed: 999 }],
  ] as const)("submits independent optional amounts (boiler=%s, current=%s, principal=%s)", async (boiler, amount, contributed, money) => {
    open(boiler ? "Boiler" : "Basic feed"); fill("Name", "Savings"); fill("Description", "Opening balance");
    if (amount) fill("Initial amount", amount);
    if (contributed) fill("Contributed amount", contributed);
    click("Submit");
    await waitFor(() => expect(addFeed).toHaveBeenCalledExactlyOnceWith({
      name: "Savings", icon: boiler ? "boiler" : "feed-pipe", description: "Opening balance", sourceType: boiler ? "boiler" : "feed", ...money,
    }));
  });

  it("retains hidden contribution drafts without submitting or validating them as a basic feed", async () => {
    open("Boiler"); fill("Name", "Savings"); fill("Contributed amount", "1.234");
    fireEvent.blur(screen.getByLabelText("Contributed amount"));
    expect(screen.getByText("Enter a nonnegative amount")).toBeTruthy();
    click("Pipe type"); click("Basic feed");
    expect(screen.queryByLabelText("Contributed amount")).toBeNull();
    click("Pipe type"); click("Boiler");
    expect(screen.getByLabelText("Contributed amount").getAttribute("value")).toBe("1.234");
    click("Pipe type"); click("Basic feed"); click("Submit");
    await waitFor(() => expect(addFeed).toHaveBeenCalledWith(expect.objectContaining({ sourceType: "feed" })));
    expect(addFeed.mock.calls[0][0]).not.toHaveProperty("contributedFed");
  });

  it("rejects incomplete precision and clears the error on correction", () => {
    open(); fill("Name", "Savings"); fill("Initial amount", "1.234"); fireEvent.blur(screen.getByLabelText("Initial amount"));
    expect(screen.getByText("Enter a nonnegative amount")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    fill("Initial amount", ""); expect(screen.queryByRole("alert")).toBeNull();
  });

  it("guards backdrop dismissal, retains cancelled drafts, and resets after confirmed discard", async () => {
    open(); fill("Name", "Savings"); fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.getByText("Discard changes?")).toBeTruthy(); click("Keep editing");
    finishAnimations();
    expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Savings");
    fireEvent.click(screen.getByTestId("modal-backdrop")); click("Discard changes");
    await waitFor(() => expect(screen.queryByLabelText("Name")).toBeNull());
    click("Add pipe"); click("Basic feed"); expect(screen.getByLabelText("Name").getAttribute("value")).toBe("");
  });

  it("retains values on failure and starts fresh after success", async () => {
    const user = userEvent.setup();
    addFeed.mockRejectedValueOnce(new Error("Connection lost"));
    open("Boiler"); fill("Name", "Savings"); fill("Initial amount", "12.34");
    finishAnimations();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Connection lost"));
    expect(screen.getByLabelText("Initial amount").getAttribute("value")).toBe("12.34");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(addFeed).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText("Name")).toBeNull();
    click("Add pipe"); click("Boiler"); expect(screen.getByLabelText("Name").getAttribute("value")).toBe("");
  });

  it("blocks dismissal, field editing and repeated submissions while saving, then unlocks on failure", async () => {
    let reject!: (error: Error) => void;
    addFeed.mockReturnValueOnce(new Promise<void>((_resolve, fail) => { reject = fail; }));
    open(); fill("Name", "Savings"); click("Submit"); click("Submit");
    expect(addFeed).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.queryByText("Discard changes?")).toBeNull();
    expect(screen.getByLabelText("Name").getAttribute("readonly")).not.toBeNull();
    await act(async () => reject(new Error("Connection lost")));
    expect(screen.getByRole("alert").textContent).toBe("Connection lost");
    click("Submit"); await waitFor(() => expect(addFeed).toHaveBeenCalledTimes(2));
  });
});
