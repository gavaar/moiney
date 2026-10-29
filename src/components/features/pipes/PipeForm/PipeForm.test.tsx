// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PipeForm } from "./PipeForm";
import { OptionListHost } from "@ui/OptionList";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { Id } from "@convex/_generated/dataModel";

const rootId = "root" as Id<"pipes">;
const root: PipeModel = { id: rootId, name: "Wallet", icon: "pipe", priority: 0, capacity: 0, spent: 0, fed: 10000 };
let allPipes: PipeModel[] = [root];
const addFeed = vi.fn().mockResolvedValue(null);
const addPipe = vi.fn().mockResolvedValue(null);
const updatePipe = vi.fn().mockResolvedValue(null);
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useOptionalEventHistoryCache: () => null }));
vi.mock("@convex/_generated/api", () => ({ api: { pipes: { addFeed: "feed", addPipe: "child", updatePipe: "edit", executePipeRuleNow: "run" } } }));
vi.mock("convex/react", () => ({ useMutation: (name: string) => name === "feed" ? addFeed : name === "edit" ? updatePipe : addPipe }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({ allPipes, isLoading: false }) }));

function create(parentId?: Id<"pipes">) {
  const rendered = render(<OptionListHost><PipeForm mode="create" parentId={parentId} onClose={vi.fn()} /></OptionListHost>);
  choose("Pipe type");
  return rendered;
}
function choose(name: string) { fireEvent.click(screen.getByRole("button", { name })); }

describe("unified pipe creation", () => {
  beforeEach(() => { vi.clearAllMocks(); allPipes = [root]; });
  afterEach(() => vi.useRealTimers());

  it("offers seven grouped types and creates a boiler from its single-page fields", async () => {
    create();
    for (const name of ["Basic feed", "Boiler", "Manual", "Instant", "Overflow", "Timed", "Self-destruct"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    choose("Boiler");
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Investments" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Initial amount" }), { target: { value: "12.34" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Contributed amount" }), { target: { value: "10" } });
    choose("Submit");
    await waitFor(() => expect(addFeed).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "boiler", icon: "boiler", initialFed: 1234, contributedFed: 1000,
    })));
    expect(addPipe).not.toHaveBeenCalled();
  });

  it.each(["Manual", "Instant", "Overflow", "Timed", "Self-destruct"])("shows %s's common fields with its owner on the first page", title => {
    create(rootId);
    expect(screen.getByRole("button", { name: "Basic feed" }).getAttribute("aria-disabled")).toBe("true");
    choose(title);
    expect(screen.getByRole("button", { name: "Owner pipe" }).textContent).toContain("Wallet");
    expect(screen.getByRole("button", { name: "Icon" })).toBeTruthy();
    for (const name of ["Name", "Priority", "Starting capacity?"]) expect(screen.getByRole("textbox", { name })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Description" })).toBeNull();
    choose("Next step");
    expect(screen.queryByRole("button", { name: "Icon" })).toBeNull();
    for (const name of ["Name", "Priority", "Starting capacity?"]) expect(screen.queryByRole("textbox", { name })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeTruthy();
    choose("Next step");
    expect(screen.getByRole("checkbox", { name: "I understand" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
  });

  it("disables inner pipes without a feed and explains why", () => {
    allPipes = [];
    create();
    expect(screen.getByRole("button", { name: "Manual" }).getAttribute("aria-disabled")).toBe("true");
    choose("About Inner pipes");
    expect(screen.getByText(/Create a feed before adding inner pipes/)).toBeTruthy();
  });

  it("preserves separate rule drafts when switching between types", () => {
    create(rootId); choose("Timed"); choose("Next step");
    fireEvent.change(screen.getByLabelText("Cap update"), { target: { value: "12" } });
    choose("Previous step"); choose("Pipe type"); choose("Instant"); choose("Next step");
    expect(screen.getByLabelText("Cap update").getAttribute("value")).toBe("");
    fireEvent.change(screen.getByLabelText("Cap update"), { target: { value: "30" } });
    choose("Previous step"); choose("Pipe type"); choose("Timed"); choose("Next step");
    expect(screen.getByLabelText("Cap update").getAttribute("value")).toBe("12");
  });

  it.each(["", "0"])("allows choosing installments before entering a nonzero capacity update (%s)", async initialCap => {
    create(rootId); choose("Timed");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Rent" } });
    choose("Next step");
    if (initialCap) fireEvent.change(screen.getByLabelText("Cap update"), { target: { value: initialCap } });
    choose("Increase Interval");

    expect(screen.getByRole("button", { name: "Spread over" }).getAttribute("aria-disabled")).not.toBe("true");
    choose("Spread over"); choose("Monthly");
    expect(screen.getByRole("button", { name: "Spread over" }).textContent).toContain("Monthly");
    expect(screen.queryByText(/Saves as/)).toBeNull();

    fireEvent.change(screen.getByLabelText("Cap update"), { target: { value: "120" } });
    expect(screen.getByText("Saves as 60.00 every 1 month.")).toBeTruthy();
    choose("Next step"); fireEvent.click(screen.getByRole("checkbox", { name: "I understand" }));
    choose("Submit");
    await waitFor(() => expect(addPipe).toHaveBeenCalledWith(expect.objectContaining({
      ruleConfig: expect.objectContaining({ capUpdateValue: 6000, interval: 1, unit: "months" }),
    })));
  });

  it.each([
    { title: "Basic feed", icon: "feed-pipe", inner: false },
    { title: "Boiler", icon: "boiler", inner: false },
    { title: "Manual", icon: "valve", inner: true },
    { title: "Instant", icon: "instant-pipe", inner: true },
    { title: "Overflow", icon: "overflow-pipe", inner: true },
    { title: "Timed", icon: "timer-outline", inner: true },
    { title: "Self-destruct", icon: "bomb-pipe", inner: true },
  ])("submits the selected $title type's default icon after acknowledging any owner warnings", async ({ title, icon, inner }) => {
    if (title === "Self-destruct") {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.UTC(2026, 8, 20, 18));
    }
    create(inner ? rootId : undefined);
    choose(title);
    expect(screen.getByRole("button", { name: "Icon" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Savings" } });
    if (title === "Self-destruct") {
      choose("Next step"); choose("Destruct date"); fireEvent.click(screen.getByTestId("day-21"));
    }
    if (inner) {
      if (title !== "Self-destruct") choose("Next step");
      choose("Next step"); fireEvent.click(screen.getByRole("checkbox", { name: "I understand" }));
    }
    choose("Submit");
    await waitFor(() => expect(inner ? addPipe : addFeed).toHaveBeenCalledWith(expect.objectContaining({ icon })));
    expect(inner ? addFeed : addPipe).not.toHaveBeenCalled();
  });

  it("updates the default icon on type changes without losing other edits", async () => {
    create(); choose("Boiler");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Savings" } });
    choose("Pipe type"); choose("Basic feed"); choose("Submit");
    await waitFor(() => expect(addFeed).toHaveBeenCalledWith(expect.objectContaining({ name: "Savings", icon: "feed-pipe" })));
  });

  it.each(["wallet-outline", "pipe"])("keeps a saved %s icon when changing an existing pipe's type", async icon => {
    const pipe: PipeModel = { ...root, id: "child" as Id<"pipes">, parentId: rootId, name: "Food", icon };
    allPipes = [root, pipe];
    render(<OptionListHost><PipeForm mode="edit" pipe={pipe} onClose={vi.fn()} /></OptionListHost>);
    choose("Previous step"); choose("Pipe type"); choose("Instant");
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Priority" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Capacity" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Icon" })).toBeTruthy();
    choose("Submit");
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({
      pipeId: pipe.id,
      ruleConfig: { rule: "instant_settlement", capUpdateValue: undefined },
    }));
  });

  it("does not validate an inner priority when creating a feed", async () => {
    create(); choose("Manual");
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "9007199254740992" } });
    choose("Pipe type"); choose("Basic feed");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Savings" } });
    expect(screen.queryByLabelText("Priority")).toBeNull();
    choose("Submit");
    await waitFor(() => expect(addFeed).toHaveBeenCalledWith({ name: "Savings", icon: "feed-pipe", sourceType: "feed", description: undefined }));
    expect(addFeed.mock.calls[0][0]).not.toHaveProperty("priority");
  });

  it("clears contingency made ineligible by changing owner and explains the change", () => {
    const reserve = { ...root, id: "reserve" as Id<"pipes">, parentId: rootId, name: "Reserve" };
    const other = { ...root, id: "other" as Id<"pipes">, name: "Other feed" };
    allPipes = [root, reserve, other];
    create(rootId); choose("Manual"); choose("Next step"); choose("Contingency"); choose("Reserve");
    choose("Previous step"); choose("Owner pipe"); choose("Other feed");
    expect(screen.getByText("Contingency cleared because it isn't available under this owner.")).toBeTruthy();
    choose("Next step");
    expect(screen.getByRole("button", { name: "Contingency" }).textContent).toContain("No contingency");
  });
});
