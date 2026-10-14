// @vitest-environment jsdom
import { fireEvent, render as renderComponent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ConfirmModalProvider } from "@ui/ConfirmModal/ConfirmModalProvider";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditPipeModal } from "./EditPipeModal";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";

const updatePipe = vi.fn().mockResolvedValue(null);
const runRule = vi.fn().mockResolvedValue(null);
let allPipes: PipeModel[];
const id = (value: string) => value as Id<"pipes">;
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useOptionalEventHistoryCache: () => null }));

function render(element: ReactNode) {
  return renderComponent(element, { wrapper: ConfirmModalProvider });
}
function ruleStep() {
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
}

vi.mock("convex/react", () => ({
  useMutation: (name: string) => name === "run" ? runRule : updatePipe,
}));

vi.mock("@convex/_generated/api", () => ({
  api: { pipes: { updatePipe: "update", executePipeRuleNow: "run", addPipe: "add" } },
}));

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({ allPipes, pipesById: Object.fromEntries(allPipes.map(pipe => [pipe.id, pipe])) }),
}));

vi.mock("@ui/Modal", () => ({
  ModalShell: ({ visible, children, onClose }: any) => (visible ? <div><button onClick={onClose}>Dismiss</button>{children}</div> : null),
}));

vi.mock("@ui/Alert", () => ({
  useAlert: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@ui/Icon", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ui/Icon")>()),
  Icon: () => null,
}));

vi.mock("@ui/Button", () => ({
  Button: ({ title, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{title}</button>,
}));

describe("EditPipeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const pipe = (key: string, name: string, parentId?: string): PipeModel => ({
      id: id(key), name, parentId: parentId ? id(parentId) : undefined, icon: "pipe", description: "Old description",
      priority: 1, capacity: 100, fed: 0, spent: 0,
    });
    allPipes = [pipe("root", "Root"), pipe("pipe-1", "Groceries", "root"), pipe("reserve", "Reserve", "root"),
      { ...pipe("chained", "Chained", "root"), contingencyPipeId: id("reserve") },
      pipe("branch", "Branch", "root"), pipe("cousin", "Cousin", "branch")];
  });

  it("validates the name on blur and clears its error during correction", () => {
    render(<EditPipeModal visible pipeId={"pipe-1" as any} onClose={vi.fn()} />);
    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "a" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(name);
    expect(screen.getByRole("alert").textContent).toBe("Name must be at least 3 characters");
    fireEvent.click(screen.getByText("Submit"));
    expect(updatePipe).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: "Food" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends an explicit clear command when the description is emptied", async () => {
    render(
      <EditPipeModal
        visible
        pipeId={"pipe-1" as any}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() =>
      expect(updatePipe).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      ),
    );
  });

  it("offers only eligible donors and saves the chosen contingency", async () => {
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    ruleStep();
    fireEvent.click(screen.getByRole("button", { name: "Contingency" }));
    expect(screen.queryByText("Chained")).toBeNull();
    expect(screen.queryByText("Branch")).toBeNull();
    expect(screen.queryByText("Cousin")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith(expect.objectContaining({ contingencyPipeId: "reserve" })));
  });

  it("displays the configured donor and explicitly clears it with No contingency", async () => {
    allPipes[1] = { ...allPipes[1], contingencyPipeId: id("reserve") };
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    ruleStep();
    expect(screen.getByRole("button", { name: "Contingency" }).textContent).toContain("Reserve");
    fireEvent.click(screen.getByRole("button", { name: "Contingency" }));
    fireEvent.click(screen.getByRole("button", { name: "No contingency" }));
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith(expect.objectContaining({ contingencyPipeId: null })));
  });

  it("omits the contingency command when only other fields were edited", async () => {
    allPipes[1] = { ...allPipes[1], contingencyPipeId: id("reserve") };
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalled());
    expect(updatePipe.mock.calls[0][0]).not.toHaveProperty("contingencyPipeId");
  });

  it("blocks a draft donor that becomes ineligible while editing and allows clearing it", async () => {
    const { rerender } = render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    ruleStep();
    fireEvent.click(screen.getByRole("button", { name: "Contingency" }));
    fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
    allPipes = allPipes.map(pipe => pipe.id === id("reserve") ? { ...pipe, contingencyPipeId: id("chained") } : pipe);
    rerender(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.getByText("Selected contingency is no longer eligible. Choose another or clear it.")).toBeTruthy();
    fireEvent.click(screen.getByText("Submit"));
    expect(updatePipe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Contingency" }));
    fireEvent.click(screen.getByRole("button", { name: "No contingency" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({ pipeId: "pipe-1", name: "Food" }));
  });

  it.each(["instant_settlement", "self_destruct"] as const)("disables contingency and explains why for a %s source", rule => {
    allPipes[1] = { ...allPipes[1], rule };
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    ruleStep();
    expect(screen.getByRole("button", { name: "Contingency" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(/This rule cannot use contingency/)).toBeTruthy();
  });

  it("starts on details without an owner step and uses Capacity on the second step", () => {
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Groceries");
    expect(screen.queryByRole("button", { name: "Previous step" })).toBeNull();
    expect(screen.queryByText("Owner pipe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByLabelText("Capacity").getAttribute("value")).toBe("1.00");
    expect(screen.queryByText("Initial capacity?")).toBeNull();
  });

  it("starts the rule shortcut on step 3 and preserves edits while going back", async () => {
    render(<EditPipeModal visible initialStep={3} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Rule" }));
    fireEvent.click(screen.getByText("Spend overflow"));
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.change(screen.getByLabelText("Capacity"), { target: { value: "-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({ pipeId: "pipe-1", name: "Food", capacity: -200,
      ruleConfig: { rule: "spend_overflow", capUpdateValue: undefined } }));
  });

  it("refreshes untouched fields without losing edits or overwriting live capacity and schedules", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    allPipes[1] = { ...allPipes[1], capacity: 500, description: "Live description", rule: "cron",
      cronNextDate: Date.UTC(2099, 1, 1, 5), cronInterval: { interval: 1, unit: "months" } };
    rerender(<EditPipeModal visible pipeId={id("pipe-1")} onClose={onClose} />);
    expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Food");
    expect(screen.getByDisplayValue("Live description")).toBeTruthy();
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({ pipeId: "pipe-1", name: "Food" }));
  });

  it("confirms dismissal only when dirty and keeps the draft when cancelled", async () => {
    const onClose = vi.fn();
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByText("Dismiss"));
    expect(screen.getByText("Discard changes?")).toBeTruthy();
    fireEvent.click(screen.getByText("Keep editing"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Food");
    fireEvent.click(screen.getByText("Dismiss"));
    fireEvent.click(screen.getByText("Discard changes"));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("resets to current saved values without leaving the current step", () => {
    render(<EditPipeModal visible initialStep={3} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Rule" }));
    fireEvent.click(screen.getByText("Spend overflow"));
    fireEvent.click(screen.getByRole("button", { name: "Reset changes" }));
    expect(screen.getByRole("button", { name: "Rule" }).textContent).toContain("No rule");
    expect(screen.getByLabelText("Step 3 of 3").getAttribute("aria-selected")).toBe("true");
  });

  it("shows details only for parents and never submits derived capacity", async () => {
    render(<EditPipeModal visible pipeId={id("root")} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Wallet" } });
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({ pipeId: "root", name: "Wallet" }));
  });

  it("requires an explicit edit capacity instead of silently leaving it unchanged", () => {
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.change(screen.getByLabelText("Capacity"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Submit"));
    expect(updatePipe).not.toHaveBeenCalled();
  });

  it("disables Run now for changes on any step and enables it again after resetting", async () => {
    const onClose = vi.fn();
    render(<EditPipeModal visible initialStep={3} pipeId={id("pipe-1")} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByText("Run now"));
    expect(runRule).not.toHaveBeenCalled();
    expect(screen.getByText("Save changes before running.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset changes" }));
    fireEvent.click(screen.getByText("Run now"));
    await waitFor(() => expect(runRule).toHaveBeenCalledWith({ pipeId: "pipe-1" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clears incompatible contingency in the draft without restoring it when switching back", async () => {
    allPipes[1] = { ...allPipes[1], contingencyPipeId: id("reserve") };
    render(<EditPipeModal visible initialStep={3} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Rule" }));
    fireEvent.click(screen.getByText("Instant settlement"));
    expect(screen.getByRole("button", { name: "Contingency" }).textContent).toContain("No contingency");
    expect(screen.getByText(/Saving will remove the current contingency/)).toBeTruthy();
    expect(updatePipe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Rule" }));
    fireEvent.click(screen.getByText("No rule"));
    expect(screen.getByRole("button", { name: "Contingency" }).textContent).toContain("No contingency");
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({ pipeId: "pipe-1", contingencyPipeId: null }));
  });

  it("lets childless roots edit rules but never offers Self-destruct", () => {
    allPipes = [{ ...allPipes[0], rule: "instant_settlement" }];
    render(<EditPipeModal visible initialStep={3} pipeId={id("root")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Rule" }));
    expect(screen.getByText("Cron")).toBeTruthy();
    expect(screen.queryByText("Self-destruct")).toBeNull();
  });

  it("follows live rule changes after reverting a rule draft", () => {
    const { rerender } = render(<EditPipeModal visible initialStep={3} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Rule" }));
    fireEvent.click(screen.getByText("Spend overflow"));
    fireEvent.click(screen.getByRole("button", { name: "Rule" }));
    fireEvent.click(screen.getByText("No rule"));
    allPipes[1] = { ...allPipes[1], rule: "cron", cronNextDate: Date.UTC(2099, 1, 1, 5), cronInterval: { interval: 1, unit: "months" } };
    rerender(<EditPipeModal visible initialStep={3} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Rule" }).textContent).toContain("Cron");
  });

  it("preserves an edited cap update while following an untouched live cron date", async () => {
    allPipes[1] = { ...allPipes[1], rule: "cron", capUpdateValue: 100,
      cronNextDate: Date.UTC(2099, 0, 1, 5), cronInterval: { interval: 1, unit: "months" } };
    const { rerender } = render(<EditPipeModal visible initialStep={3} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Cap update"), { target: { value: "2" } });
    allPipes[1] = { ...allPipes[1], capacity: 200, cronNextDate: Date.UTC(2099, 1, 1, 5) };
    rerender(<EditPipeModal visible initialStep={3} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Cap update").getAttribute("value")).toBe("2");
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({ pipeId: "pipe-1",
      ruleConfig: { rule: "cron", capUpdateValue: 200, interval: 1, unit: "months", starting: Date.UTC(2099, 1, 1, 5) } }));
  });

  it("does not replace an unfamiliar saved icon during a name-only edit", async () => {
    allPipes[1] = { ...allPipes[1], icon: "legacy-icon" };
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({ pipeId: "pipe-1", name: "Food" }));
  });

  it("preserves an untouched whitespace description during a name-only edit", async () => {
    allPipes[1] = { ...allPipes[1], description: "   " };
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({ pipeId: "pipe-1", name: "Food" }));
  });
});
