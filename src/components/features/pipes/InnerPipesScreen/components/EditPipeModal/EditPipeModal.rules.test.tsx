// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render as renderComponent, screen, fireEvent } from "@testing-library/react";
import { ConfirmModalProvider } from "@ui/ConfirmModal";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import { computeElapsedIntervals } from "@domain/scheduling";
import { EditPipeModal } from "./EditPipeModal";

vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
const h = vi.hoisted(() => ({
  api: { pipes: { updatePipe: "update", executePipeRuleNow: "run" } },
  update: vi.fn(),
  run: vi.fn(),
  invalidate: vi.fn(),
  alert: { success: vi.fn(), error: vi.fn() },
  catalog: vi.fn(),
}));
vi.mock("@convex/_generated/api", () => ({ api: h.api }));
vi.mock("convex/react", () => ({ useMutation: (ref: string) => ref === "update" ? h.update : h.run }));
vi.mock("@ui/Alert", () => ({ useAlert: () => h.alert }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useOptionalEventHistoryCache: () => ({ invalidateHistory: h.invalidate }) }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => h.catalog() }));
const id = (value: string) => value as Id<"pipes">;
function pipe(overrides: Partial<PipeModel> = {}): PipeModel {
  return { id: id("pipe-1"), parentId: id("parent"), name: "Groceries", icon: "cart-outline", capacity: 0, priority: 0, fed: 0, spent: 0, ...overrides };
}
function open(value = pipe(), onClose = vi.fn(), overview = false) {
  const parent = { ...pipe(), id: id("parent"), parentId: undefined, name: "Wallet" };
  h.catalog.mockReturnValue({ pipesById: { "pipe-1": value, parent }, allPipes: [parent, value], isLoading: false });
  return renderComponent(<ConfirmModalProvider><EditPipeModal visible initialStep={overview ? 0 : 1} pipeId={id("pipe-1")} onClose={onClose} /></ConfirmModalProvider>);
}
function click(name: string) { fireEvent.click(screen.getByRole("button", { name })); }
function kind(name: string) {
  if (!screen.queryByRole("button", { name: "Pipe type" })) click("Previous step");
  click("Pipe type"); click(name); click("Next step");
}
async function submit(name = "Submit") { await act(async () => click(name)); }
function cap(value: string) { fireEvent.change(screen.getByLabelText("Cap update"), { target: { value } }); }
const timed = (extra: Partial<PipeModel> = {}) => pipe({
  rule: "cron",
  capUpdateValue: 5000,
  cronInterval: { interval: 1, unit: "months" },
  cronNextDate: Date.UTC(2026, 0, 15, 12),
  ...extra,
});

describe("pipe behavior editing", () => {
  beforeEach(() => { vi.clearAllMocks(); h.update.mockResolvedValue(undefined); h.run.mockResolvedValue(undefined); h.invalidate.mockResolvedValue(undefined); });
  afterEach(() => vi.useRealTimers());

  it("edits and cancels Self-destruct without manual settlement or capacity updates", async () => {
    const value = pipe({ rule: "self_destruct", cronNextDate: Date.UTC(2099, 0, 21, 5), cronInterval: { interval: 0.5, unit: "days" } });
    const onClose = vi.fn(); const { unmount } = open(value, onClose);
    expect(screen.queryByRole("button", { name: "Run now" })).toBeNull(); expect(screen.queryByLabelText("Cap update")).toBeNull();
    expect(screen.getByRole("button", { name: "Contingency" })).toBeTruthy();
    click("Destruct date"); fireEvent.click(screen.getByTestId("day-22")); await submit();
    expect(h.update).toHaveBeenCalledWith({ pipeId: id("pipe-1"), ruleConfig: { rule: "self_destruct", starting: Date.UTC(2099, 0, 22, 5) } });
    expect(onClose).toHaveBeenCalledOnce(); expect(h.run).not.toHaveBeenCalled();
    unmount(); open(value); kind("Manual"); await submit();
    expect(h.update).toHaveBeenLastCalledWith({ pipeId: id("pipe-1"), ruleConfig: { rule: undefined } });
  });

  it("does not save a destruct deadline that passes between validation and submission", async () => {
    vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2099, 0, 21, 5));
    open(pipe({ rule: "self_destruct", cronNextDate: Date.UTC(2099, 0, 21, 5), cronInterval: { interval: 1, unit: "days" } }));
    click("Destruct date"); fireEvent.click(screen.getByTestId("day-22"));
    vi.setSystemTime(Date.UTC(2099, 0, 22, 7)); await submit();
    expect(h.update).not.toHaveBeenCalled(); expect(h.alert.error).toHaveBeenCalled();
  });

  it("starts collapsed and offers five inner behaviors but no root conversions", () => {
    open(pipe(), vi.fn(), true);
    expect(screen.getByRole("button", { name: "Pipe type" }).getAttribute("aria-expanded")).toBe("false");
    click("Pipe type");
    for (const name of ["Manual", "Instant", "Overflow", "Timed", "Self-destruct"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Basic feed" })).toBeNull(); expect(screen.queryByRole("button", { name: "Boiler" })).toBeNull();
  });
  it("updates the behavior summary when the selected type changes", () => {
    open(pipe(), vi.fn(), true);
    expect(screen.getByText("Accumulate spending; settle when you choose.")).toBeTruthy();
    click("Pipe type"); click("Instant");
    expect(screen.getByText("Settle spending immediately, to show exact holdings.")).toBeTruthy();
    expect(screen.queryByText("Accumulate spending; settle when you choose.")).toBeNull();
  });
  it("initializes timed fields from the saved rule", () => {
    open(timed({ capUpdateValue: 10000, cronInterval: { interval: 2, unit: "years" } }));
    expect(screen.getByDisplayValue("100.00")).toBeTruthy(); expect(screen.getByDisplayValue("2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unit" }).textContent).toContain("Year");
  });
  it("shows scheduling fields only for Timed", () => {
    open(); expect(screen.queryByLabelText("Interval")).toBeNull(); kind("Timed");
    for (const name of ["Cap update", "Interval"]) expect(screen.getByLabelText(name)).toBeTruthy();
    for (const name of ["Unit", "Starting date", "Spread over"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    kind("Manual"); expect(screen.queryByLabelText("Interval")).toBeNull();
  });
  it("previews and saves a yearly capacity update spread into monthly installments", async () => {
    open(timed({ capacity: 10000, capUpdateValue: 120000, cronInterval: { interval: 1, unit: "years" }, cronNextDate: Date.UTC(2099, 0, 15, 12) }));
    click("Spread over"); click("Monthly");
    expect(screen.getByText("Saves as 100.00 every 1 month.")).toBeTruthy();
    expect(screen.getByText("After settlement: capacity will become whatever funds are left plus 100.00.")).toBeTruthy();
    await submit();
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ ruleConfig: expect.objectContaining({ capUpdateValue: 10000, interval: 1, unit: "months" }) }));
  });
  it("uses the normalized installment schedule in backdated-credit warnings", () => {
    open(timed({ capUpdateValue: 120000, cronInterval: { interval: 1, unit: "years" } })); click("Spread over"); click("Monthly");
    const elapsed = computeElapsedIntervals(Date.UTC(2026, 0, 15, 12), 1, "months", Date.now());
    expect(screen.getByText(`Saving adds ${(elapsed * 100).toFixed(2)} capacity for the ${elapsed} months since the starting date.`)).toBeTruthy();
  });
  it("allows choosing installments but omits their preview when capacity update is zero", () => {
    open(timed({ capUpdateValue: 0, cronInterval: { interval: 1, unit: "years" } }));
    expect(screen.getByRole("button", { name: "Spread over" }).getAttribute("aria-disabled")).not.toBe("true");
    click("Spread over"); click("Monthly");
    expect(screen.queryByText(/Saves as/)).toBeNull();
  });
  it("hides capacity updates for Manual", () => { open(); expect(screen.queryByLabelText("Cap update")).toBeNull(); });
  it.each(["instant_settlement", "spend_overflow"] as const)("shows signed capacity updates for %s", rule => {
    open(pipe({ rule })); expect(screen.getByLabelText("Cap update")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change Cap update sign, currently positive" })).toBeTruthy();
  });
  it("previews retained capacity for blank and an update for explicit zero", () => {
    open(pipe({ rule: "instant_settlement", capacity: 10000 }));
    expect(screen.getByPlaceholderText("Keep capacity unchanged")).toBeTruthy();
    expect(screen.getByText("After settlement: capacity stays at 100.00.")).toBeTruthy();
    cap("0");
    expect(screen.queryByText("After settlement: capacity stays at 100.00.")).toBeNull();
    expect(screen.getByText("After settlement: capacity will become whatever funds are left plus 0.00.")).toBeTruthy();
  });
  it.each([
    { capUpdateValue: 2500, adjustment: "plus 25.00" },
    { capUpdateValue: -2500, adjustment: "minus 25.00" },
  ])("previews the signed settlement update ($adjustment)", ({ capUpdateValue, adjustment }) => {
    open(pipe({ rule: "instant_settlement", capacity: 10000, capUpdateValue }));
    expect(screen.getByText(`After settlement: capacity will become whatever funds are left ${adjustment}.`)).toBeTruthy();
  });
  it("saves an Instant capacity update", async () => {
    open(pipe({ rule: "instant_settlement", capacity: 10000 })); cap("50"); await submit();
    expect(h.update).toHaveBeenCalledWith({ pipeId: id("pipe-1"), ruleConfig: { rule: "instant_settlement", capUpdateValue: 5000 } });
  });
  it("runs an unchanged Manual pipe and reports success", async () => {
    open(); expect(document.querySelector('[name="water-outline"]')).toBeTruthy(); await submit("Run now");
    expect(h.run).toHaveBeenCalledWith({ pipeId: id("pipe-1") }); expect(h.alert.success).toHaveBeenCalledWith("Rule executed");
  });
  it("closes after a successful manual settlement", async () => {
    const close = vi.fn(); open(pipe(), close); await submit("Run now"); expect(close).toHaveBeenCalledOnce();
  });
  it("refreshes history without turning a cache failure into a settlement failure", async () => {
    h.invalidate.mockRejectedValueOnce(new Error("Storage unavailable")); const close = vi.fn(); open(pipe(), close); await submit("Run now");
    expect(h.invalidate).toHaveBeenCalledOnce(); expect(h.alert.error).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce();
  });
  it("saves Instant and closes the editor", async () => {
    const close = vi.fn(); open(pipe(), close); kind("Instant"); await submit();
    expect(h.update).toHaveBeenCalledWith({ pipeId: id("pipe-1"), ruleConfig: { rule: "instant_settlement", capUpdateValue: undefined } }); expect(close).toHaveBeenCalledOnce();
  });
  it("clears the persisted rule when switching to Manual", async () => {
    open(timed()); kind("Manual"); await submit(); expect(h.update).toHaveBeenCalledWith({ pipeId: id("pipe-1"), ruleConfig: { rule: undefined } });
  });
  it("saves a recurring interval with its unit, start and capacity update", async () => {
    const close = vi.fn(); open(timed(), close); click("Increase Interval"); await submit();
    expect(h.update).toHaveBeenCalledWith({ pipeId: id("pipe-1"), ruleConfig: { rule: "cron", interval: 2, unit: "months", capUpdateValue: 5000, starting: expect.any(Number) } });
    expect(close).toHaveBeenCalledOnce();
  });
  it("does not run or save an unchanged Timed pipe", async () => {
    open(timed()); expect(screen.queryByRole("button", { name: "Run now" })).toBeNull(); await submit();
    expect(h.update).not.toHaveBeenCalled(); expect(h.run).not.toHaveBeenCalled();
  });
  it("shows accrued credit for a backdated schedule", () => {
    open(timed()); const elapsed = computeElapsedIntervals(Date.UTC(2026, 0, 15, 12), 1, "months", Date.now());
    expect(screen.getByText(`Saving adds ${(elapsed * 50).toFixed(2)} capacity for the ${elapsed} months since the starting date.`)).toBeTruthy();
  });
  it("updates accrued credit when the capacity update changes", () => {
    open(timed()); cap("100"); const elapsed = computeElapsedIntervals(Date.UTC(2026, 0, 15, 12), 1, "months", Date.now());
    expect(screen.getByText(`Saving adds ${(elapsed * 100).toFixed(2)} capacity for the ${elapsed} months since the starting date.`)).toBeTruthy();
  });
  it("hides accrued-credit warnings when capacity update becomes zero", () => { open(timed()); cap("0"); expect(screen.queryByText(/Saving adds/)).toBeNull(); });
  it("hides accrued-credit warnings for future starts", () => { open(timed({ cronNextDate: Date.UTC(2099, 0, 15, 12) })); expect(screen.queryByText(/Saving adds/)).toBeNull(); });
  it("reports save failures without closing", async () => {
    h.update.mockRejectedValueOnce(new Error("boom")); const close = vi.fn(); open(pipe({ rule: "instant_settlement" }), close); kind("Manual"); await submit();
    expect(h.alert.error).toHaveBeenCalledWith("boom"); expect(close).not.toHaveBeenCalled();
  });
  it("reports manual settlement failures without closing", async () => {
    h.run.mockRejectedValueOnce(new Error("nope")); const close = vi.fn(); open(pipe(), close); await submit("Run now");
    expect(h.alert.error).toHaveBeenCalledWith("nope"); expect(close).not.toHaveBeenCalled();
  });
});
