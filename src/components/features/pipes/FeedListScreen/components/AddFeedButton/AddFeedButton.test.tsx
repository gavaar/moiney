// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddFeedButton } from "./AddFeedButton";
import { ADD_FEED_DEFAULTS, buildAddFeedForm } from "./addFeedForm.config";

const mockAddFeed = vi.fn();
const mockShowAlert = { success: vi.fn(), error: vi.fn() };
vi.mock("convex/react", () => ({ useMutation: () => mockAddFeed }));
vi.mock("@ui/Alert", () => ({ useAlert: () => mockShowAlert }));
vi.mock("@convex/_generated/api", () => ({ api: { pipes: { addFeed: {} } } }));

function finishAnimations() {
  document.querySelectorAll('[aria-modal="true"]').forEach((modal) => {
    let animatedElement = modal.parentElement;
    while (animatedElement && animatedElement !== document.body) {
      fireEvent.animationEnd(animatedElement);
      fireEvent(animatedElement, new Event("webkitAnimationEnd", { bubbles: true }));
      animatedElement = animatedElement.parentElement;
    }
  });
}

async function openModal() {
  const user = userEvent.setup();
  render(<AddFeedButton />);
  await user.click(screen.getByText("Add new Feed"));
  finishAnimations();
  return user;
}

async function fillIdentity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/Feed name|Boiler name/), "Savings");
  await user.click(screen.getByTestId("icon-picker-trigger"));
  finishAnimations();
  await user.click(screen.getByText("wallet-outline"));
  finishAnimations();
}

describe("AddFeedButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddFeed.mockResolvedValue(undefined);
  });

  it.each(["amount", "contributed"] as const)("rejects negative and unsupported %s values through the configured validator", (key) => {
    const field = buildAddFeedForm({ ...ADD_FEED_DEFAULTS, isBoiler: true }).find((field) => field.key === key)!;
    if (field.key !== "amount" && field.key !== "contributed") throw new Error("Expected an opening amount field");
    for (const invalid of ["-0.01", "1.234", "abc", "1000000000.01", "9007199254740992"]) {
      expect(field.validator(invalid)).not.toBeNull();
    }
    for (const valid of ["", "0", "0.01", "123.45", "1000000000.00"]) {
      expect(field.validator(valid)).toBeNull();
    }
  });

  it("places identity and type explanation first and the final action only on the money step", async () => {
    const user = await openModal();
    expect(screen.getByRole("heading", { name: "Create Feed" })).toBeDefined();
    expect(screen.getByText("A feed is a source for money entering your budget. Accounts, cash, and wallets are all feeds.")).toBeDefined();
    expect(screen.queryByTestId("add-feed-submit")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Initial amount" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Boiler" }));
    expect(screen.getByRole("heading", { name: "Create Boiler" })).toBeDefined();
    expect(screen.getByText("A boiler tracks an asset's current value and contributed principal separately. Think of investment accounts.")).toBeDefined();
    await user.click(screen.getByText("Next"));
    expect(screen.queryByText("Next")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Initial amount" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Contributed amount" })).toBeDefined();
    expect(screen.getByText("The asset's current value, including any gains or losses. Leave blank to start at zero.")).toBeDefined();
    expect(screen.getByText("The total principal you have put into this asset, excluding gains or losses. Leave blank to start at zero.")).toBeDefined();
    expect(screen.getByTestId("add-feed-submit").getAttribute("aria-disabled")).toBe("true");
    await user.click(screen.getByText("Back"));
    expect(screen.queryByTestId("add-feed-submit")).toBeNull();
  });

  it("validates name on edits, marks error dots, and allows navigation without allowing invalid submission", async () => {
    const user = await openModal();
    const name = screen.getByPlaceholderText("Feed name");
    await user.click(name);
    await user.tab();
    expect(screen.queryByText("Name is required")).toBeNull();
    await user.type(name, "a");
    expect(screen.getByText("Name must be at least 2 characters")).toBeDefined();
    await user.clear(name);
    expect(screen.getByText("Name is required")).toBeDefined();
    expect(screen.getByLabelText("Step 1 of 2, has errors")).toBeDefined();
    await user.click(screen.getByText("Next"));
    expect(screen.getByTestId("add-feed-submit").getAttribute("aria-disabled")).toBe("true");
    await user.click(screen.getByText("Back"));
    await user.type(name, "Food");
    expect(screen.queryByText("Name is required")).toBeNull();
    expect(screen.getByLabelText("Step 1 of 2")).toBeDefined();
    await user.click(screen.getByText("Next"));
    expect(screen.getByTestId("add-feed-submit").getAttribute("aria-disabled")).toBe("true");
    expect(mockAddFeed).not.toHaveBeenCalled();
  });

  it.each([
    [false, "123.45", "", { initialFed: 12345 }],
    [false, "", "", {}],
    [true, "", "", {}],
    [true, "0", "100.01", { initialFed: 0, contributedFed: 10001 }],
    [true, "150.23", "100.12", { initialFed: 15023, contributedFed: 10012 }],
    [true, "", "9.99", { contributedFed: 999 }],
    [true, "9.99", "", { initialFed: 999 }],
  ])("submits exact independent optional amounts (boiler=%s, current=%s, principal=%s)", async (isBoiler, amount, contributed, money) => {
    const user = await openModal();
    if (isBoiler) await user.click(screen.getByRole("radio", { name: "Boiler" }));
    await fillIdentity(user);
    await user.type(screen.getByPlaceholderText("Optional description"), "Opening balance");
    await user.click(screen.getByText("Next"));
    if (!isBoiler) expect(screen.getByText("The money currently available in this feed. Leave blank to start at zero.")).toBeDefined();
    if (amount) await user.type(screen.getByLabelText("Initial amount"), amount);
    if (contributed) await user.type(screen.getByLabelText("Contributed amount"), contributed);
    expect(screen.getByTestId("add-feed-submit").getAttribute("aria-disabled")).toBeNull();
    await user.click(screen.getByTestId("add-feed-submit"));
    await waitFor(() => expect(mockAddFeed).toHaveBeenCalledExactlyOnceWith({
      name: "Savings", icon: "wallet-outline", description: "Opening balance",
      sourceType: isBoiler ? "boiler" : "feed", ...money,
    }));
    expect(mockShowAlert.success).toHaveBeenCalledWith(isBoiler ? "Boiler added" : "Feed added");
  });

  it("preserves hidden contributed drafts but ignores their errors and values when submitting a feed", async () => {
    const user = await openModal();
    await user.click(screen.getByRole("radio", { name: "Boiler" }));
    await fillIdentity(user);
    await user.click(screen.getByText("Next"));
    await user.type(screen.getByLabelText("Contributed amount"), "1.234");
    expect(screen.getByText("Enter a valid contribution")).toBeDefined();
    expect(screen.getByLabelText("Step 2 of 2, has errors")).toBeDefined();
    expect(screen.getByTestId("add-feed-submit").getAttribute("aria-disabled")).toBe("true");
    await user.click(screen.getByText("Back"));
    await user.click(screen.getByRole("radio", { name: "Feed" }));
    await user.type(screen.getByPlaceholderText("Optional description"), "Retained");
    await user.click(screen.getByRole("radio", { name: "Boiler" }));
    await user.click(screen.getByText("Next"));
    expect((screen.getByLabelText("Contributed amount") as HTMLInputElement).value).toBe("1.234");
    await user.click(screen.getByText("Back"));
    await user.click(screen.getByRole("radio", { name: "Feed" }));
    await user.click(screen.getByText("Next"));
    expect(screen.queryByLabelText("Contributed amount")).toBeNull();
    expect(screen.getByLabelText("Step 2 of 2")).toBeDefined();
    expect(screen.getByTestId("add-feed-submit").getAttribute("aria-disabled")).toBeNull();
    await user.click(screen.getByTestId("add-feed-submit"));
    expect(mockAddFeed).toHaveBeenCalledExactlyOnceWith({ name: "Savings", icon: "wallet-outline", description: "Retained", sourceType: "feed" });
  });

  it("rejects invalid current precision and clears the error on correction", async () => {
    const user = await openModal();
    await fillIdentity(user);
    await user.click(screen.getByText("Next"));
    await user.type(screen.getByLabelText("Initial amount"), "1.234");
    expect(screen.getByText("Enter a valid amount")).toBeDefined();
    expect(screen.getByTestId("add-feed-submit").getAttribute("aria-disabled")).toBe("true");
    await user.clear(screen.getByLabelText("Initial amount"));
    expect(screen.queryByText("Enter a valid amount")).toBeNull();
    expect(screen.getByTestId("add-feed-submit").getAttribute("aria-disabled")).toBeNull();
  });

  it("preserves draft on backdrop dismissal but restarts navigation and edit validation", async () => {
    const user = await openModal();
    await user.type(screen.getByPlaceholderText("Feed name"), "a");
    await user.click(screen.getByText("Next"));
    await user.click(screen.getByTestId("modal-backdrop"));
    finishAnimations();
    await user.click(screen.getByText("Add new Feed"));
    finishAnimations();
    expect((screen.getByPlaceholderText("Feed name") as HTMLInputElement).value).toBe("a");
    expect(screen.queryByText("Name must be at least 2 characters")).toBeNull();
    expect(screen.queryByTestId("add-feed-submit")).toBeNull();
    expect(screen.getByLabelText("Step 1 of 2").getAttribute("aria-selected")).toBe("true");
  });

  it("retains values and navigation on failure and resets everything after success", async () => {
    mockAddFeed.mockRejectedValueOnce(new Error("Server error"));
    const user = await openModal();
    await user.click(screen.getByRole("radio", { name: "Boiler" }));
    await fillIdentity(user);
    await user.click(screen.getByText("Next"));
    await user.type(screen.getByLabelText("Initial amount"), "12.34");
    await user.click(screen.getByTestId("add-feed-submit"));
    expect(mockShowAlert.error).toHaveBeenCalledWith("Server error");
    expect((screen.getByLabelText("Initial amount") as HTMLInputElement).value).toBe("12.34");
    await user.click(screen.getByTestId("add-feed-submit"));
    expect(mockAddFeed).toHaveBeenCalledTimes(2);
    finishAnimations();
    await user.click(screen.getByText("Add new Feed"));
    finishAnimations();
    expect(screen.getByRole("heading", { name: "Create Feed" })).toBeDefined();
    expect((screen.getByPlaceholderText("Feed name") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("wallet-outline")).toBeNull();
    expect(screen.queryByTestId("add-feed-submit")).toBeNull();
    await user.click(screen.getByText("Next"));
    expect((screen.getByLabelText("Initial amount") as HTMLInputElement).value).toBe("");
    expect(screen.getByTestId("add-feed-submit").getAttribute("aria-disabled")).toBe("true");
  });

  it("disables fields and guards repeated submissions while loading", async () => {
    let resolve!: () => void;
    mockAddFeed.mockReturnValueOnce(new Promise<void>((done) => { resolve = done; }));
    const user = await openModal();
    await fillIdentity(user);
    await user.click(screen.getByText("Next"));
    await user.dblClick(screen.getByTestId("add-feed-submit"));
    expect(mockAddFeed).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("Initial amount") as HTMLInputElement).readOnly).toBe(true);
    await user.click(screen.getByText("Back"));
    expect((screen.getByPlaceholderText("Feed name") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByRole("radio", { name: "Boiler" }).getAttribute("aria-disabled")).toBe("true");
    await act(async () => resolve());
  });

  it("retains the pending draft when dismissed and reopened, then unlocks it on failure", async () => {
    let reject!: (error: Error) => void;
    mockAddFeed.mockReturnValueOnce(new Promise<void>((_resolve, fail) => { reject = fail; }));
    const user = await openModal();
    await fillIdentity(user);
    await user.click(screen.getByText("Next"));
    await user.click(screen.getByTestId("add-feed-submit"));
    await user.click(screen.getByTestId("modal-backdrop"));
    finishAnimations();
    await user.click(screen.getByText("Add new Feed"));
    finishAnimations();
    const name = screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
    expect(name.value).toBe("Savings");
    expect(name.readOnly).toBe(true);
    await user.click(screen.getByText("Next"));
    expect(screen.getByTestId("add-feed-submit").getAttribute("aria-disabled")).toBe("true");
    await act(async () => reject(new Error("Connection lost")));
    expect(mockShowAlert.error).toHaveBeenCalledWith("Connection lost");
    expect(screen.getByTestId("add-feed-submit").getAttribute("aria-disabled")).toBeNull();
    await user.click(screen.getByTestId("add-feed-submit"));
    expect(mockAddFeed).toHaveBeenCalledTimes(2);
  });
});
