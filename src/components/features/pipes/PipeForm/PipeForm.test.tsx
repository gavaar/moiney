// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PipeForm } from "./PipeForm";
import { OptionListHost } from "@ui/OptionList";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { Id } from "@convex/_generated/dataModel";

const rootId = "root" as Id<"pipes">;
const root: PipeModel = { id: rootId, name: "Wallet", icon: "pipe", priority: 0, capacity: 0, spent: 0, fed: 10000 };
let allPipes: PipeModel[] = [root];
const addFeed = vi.fn().mockResolvedValue(null);
const addPipe = vi.fn().mockResolvedValue(null);
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
vi.mock("@ui/Alert", () => ({ useAlert: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useOptionalEventHistoryCache: () => null }));
vi.mock("@convex/_generated/api", () => ({ api: { pipes: { addFeed: "feed", addPipe: "child", updatePipe: "edit", executePipeRuleNow: "run" } } }));
vi.mock("convex/react", () => ({ useMutation: (name: string) => name === "feed" ? addFeed : addPipe }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({ allPipes, isLoading: false }) }));

function create(parentId?: Id<"pipes">) {
  const rendered = render(<OptionListHost><PipeForm mode="create" parentId={parentId} onClose={vi.fn()} /></OptionListHost>);
  choose("Pipe type");
  return rendered;
}
function choose(name: string) { fireEvent.click(screen.getByRole("button", { name })); }

describe("unified pipe creation", () => {
  beforeEach(() => { vi.clearAllMocks(); allPipes = [root]; });

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
      sourceType: "boiler", icon: "pipe", initialFed: 1234, contributedFed: 1000,
    })));
    expect(addPipe).not.toHaveBeenCalled();
  });

  it("disables root types for contextual creation and keeps owner with type on the first of two pages", () => {
    create(rootId);
    expect(screen.getByRole("button", { name: "Basic feed" }).getAttribute("aria-disabled")).toBe("true");
    choose("Manual");
    expect(screen.getByRole("button", { name: "Owner pipe" }).textContent).toContain("Wallet");
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    choose("Next step");
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Initial capacity?" })).toBeTruthy();
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

  it("does not validate an inner priority when creating a feed", async () => {
    create(); choose("Manual"); choose("Next step");
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "9007199254740992" } });
    choose("Previous step"); choose("Pipe type"); choose("Basic feed");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Savings" } });
    expect(screen.queryByLabelText("Priority")).toBeNull();
    choose("Submit");
    await waitFor(() => expect(addFeed).toHaveBeenCalledWith({ name: "Savings", icon: "pipe", sourceType: "feed", description: undefined }));
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
