// @vitest-environment jsdom
import { fireEvent, render as renderComponent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ConfirmModalProvider } from "@ui/ConfirmModal";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditPipeModal } from "./EditPipeModal";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import { OptionListHost } from "@ui/OptionList";

const updatePipe = vi.fn().mockResolvedValue(null);
const runRule = vi.fn().mockResolvedValue(null);
let allPipes: PipeModel[];
const id = (value: string) => value as Id<"pipes">;
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({ useOptionalEventHistoryCache: () => null }));

function render(element: ReactNode) {
  return renderComponent(element, { wrapper: ({ children }) => <OptionListHost><ConfirmModalProvider>{children}</ConfirmModalProvider></OptionListHost> });
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
      id: id(key),
      name,
      parentId: parentId ? id(parentId) : undefined,
      icon: "pipe",
      description: "Old description",
      priority: 1,
      capacity: 100,
      fed: 0,
      spent: 0,
    });
    allPipes = [
      pipe("root", "Root"),
      pipe("pipe-1", "Groceries", "root"),
      pipe("reserve", "Reserve", "root"),
      { ...pipe("chained", "Chained", "root"), contingencyPipeId: id("reserve") },
      pipe("branch", "Branch", "root"),
      pipe("cousin", "Cousin", "branch")
    ];
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
    fireEvent.click(screen.getByRole("button", { name: "Contingency" }));
    fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
    allPipes = allPipes.map(pipe => pipe.id === id("reserve") ? { ...pipe, contingencyPipeId: id("chained") } : pipe);
    rerender(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.getByText("Selected contingency is no longer eligible. Choose another or clear it.")).toBeTruthy();
    fireEvent.click(screen.getByText("Submit"));
    expect(updatePipe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Contingency" }));
    fireEvent.click(screen.getByRole("button", { name: "No contingency" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({ pipeId: "pipe-1", name: "Food" }));
  });

  it.each(["instant_settlement", "self_destruct"] as const)("offers contingency only for compatible %s sources", rule => {
    allPipes[1] = { ...allPipes[1], rule };
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    if (rule === "instant_settlement") expect(screen.queryByRole("button", { name: "Contingency" })).toBeNull();
    else expect(screen.getByRole("button", { name: "Contingency" }).getAttribute("aria-disabled")).not.toBe("true");
  });

  it("starts on the details page with Capacity and keeps ownership read-only on the overview", () => {
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Groceries");
    expect(screen.getByLabelText("Capacity").getAttribute("value")).toBe("1.00");
    expect(screen.queryByText("Initial capacity?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.getByRole("button", { name: "Owner pipe" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("starts the rule shortcut on the overview and saves behavior with detail edits", async () => {
    render(<EditPipeModal visible initialStep={0} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    expect(screen.queryByRole("button", { name: "Basic feed" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Overflow" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.change(screen.getByLabelText("Capacity"), { target: { value: "-2" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({
      pipeId: "pipe-1",
      name: "Food",
      capacity: -200,
      ruleConfig: { rule: "spend_overflow", capUpdateValue: undefined }
    }));
  });

  it("refreshes untouched fields without losing edits or overwriting live capacity and schedules", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    allPipes[1] = {
      ...allPipes[1],
      capacity: 500,
      description: "Live description",
      rule: "cron",
      cronNextDate: Date.UTC(2099, 1, 1, 5),
      cronInterval: { interval: 1, unit: "months" }
    };
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

  it("retains explicit field edits when live data temporarily agrees with them", () => {
    const { rerender } = render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    allPipes[1] = { ...allPipes[1], name: "Food" };
    rerender(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Local description" } });
    allPipes[1] = { ...allPipes[1], name: "Remote name" };
    rerender(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Food");
    expect(screen.getByDisplayValue("Local description")).toBeTruthy();
  });

  it.each([
    { label: "Name", value: " Groceries " },
    { label: "Capacity", value: "1" },
  ])("protects raw $label edits without enabling an empty save", ({ label, value }) => {
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.getByRole("button", { name: "Submit" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByText("Submit"));
    expect(updatePipe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Dismiss"));
    expect(screen.getByText("Discard changes?")).toBeTruthy();
  });

  it("protects modified inactive behavior drafts even when the active saved behavior is unchanged", () => {
    const onClose = vi.fn();
    render(<EditPipeModal visible initialStep={0} pipeId={id("pipe-1")} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Timed" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.change(screen.getByLabelText("Cap update"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    expect(screen.getByRole("button", { name: "Run now" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Submit" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Save the edited type, or reset changes before running.")).toBeTruthy();
    fireEvent.click(screen.getByText("Dismiss"));
    expect(screen.getByText("Discard changes?")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Keep editing"));
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Timed" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByLabelText("Cap update").getAttribute("value")).toBe("12");
  });

  it("resets to current saved values without leaving the current step", () => {
    render(<EditPipeModal visible initialStep={0} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Overflow" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset changes" }));
    expect(screen.getByRole("button", { name: "Pipe type" }).textContent).toContain("Manual");
    expect(screen.getByLabelText("Step 1 of 2").getAttribute("aria-selected")).toBe("true");
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
    fireEvent.change(screen.getByLabelText("Capacity"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Submit"));
    expect(updatePipe).not.toHaveBeenCalled();
  });

  it("disables Run now for changes on any step and enables it again after resetting", async () => {
    const onClose = vi.fn();
    render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByText("Run now"));
    expect(runRule).not.toHaveBeenCalled();
    expect(screen.getByText("Save changes before running.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset changes" }));
    fireEvent.click(screen.getByText("Run now"));
    await waitFor(() => expect(runRule).toHaveBeenCalledWith({ pipeId: "pipe-1" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clears incompatible contingency only when saving Instant", async () => {
    allPipes[1] = { ...allPipes[1], contingencyPipeId: id("reserve") };
    render(<EditPipeModal visible initialStep={0} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Instant" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.queryByRole("button", { name: "Contingency" })).toBeNull();
    expect(screen.getByText(/Saving will remove the current contingency/)).toBeTruthy();
    expect(updatePipe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({ pipeId: "pipe-1", contingencyPipeId: null, ruleConfig: { rule: "instant_settlement", capUpdateValue: undefined } }));
  });

  it("keeps childless roots Instant-only with no opening amounts or editable rule", () => {
    allPipes = [{ ...allPipes[0], rule: "instant_settlement" }];
    render(<EditPipeModal visible pipeId={id("root")} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Pipe type" })).toBeNull();
    expect(screen.queryByLabelText("Capacity")).toBeNull();
    expect(screen.queryByLabelText("Initial amount")).toBeNull();
    expect(screen.getByText(/Feeds settle spending instantly/)).toBeTruthy();
  });

  it("preserves explicit inactive edits when live data adopts that behavior", () => {
    allPipes[1] = {
      ...allPipes[1],
      rule: "cron",
      capUpdateValue: 100,
      cronNextDate: Date.UTC(2099, 0, 1, 5),
      cronInterval: { interval: 1, unit: "months" },
    };
    const { rerender } = render(<EditPipeModal visible initialStep={0} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Overflow" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.change(screen.getByLabelText("Cap update"), { target: { value: "1.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Timed" }));
    allPipes[1] = { ...allPipes[1], rule: "spend_overflow", capUpdateValue: 200 };
    rerender(<EditPipeModal visible initialStep={0} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Overflow" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByLabelText("Cap update").getAttribute("value")).toBe("1.00");
  });

  it("retains visited type options when live data switches to a different behavior", () => {
    allPipes[1] = {
      ...allPipes[1],
      rule: "cron",
      capUpdateValue: 100,
      cronNextDate: Date.UTC(2099, 0, 1, 5),
      cronInterval: { interval: 1, unit: "months" },
    };
    const { rerender } = render(<EditPipeModal visible initialStep={0} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Overflow" }));
    allPipes[1] = { ...allPipes[1], rule: undefined, capUpdateValue: undefined, cronNextDate: undefined, cronInterval: undefined };
    rerender(<EditPipeModal visible initialStep={0} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Timed" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByLabelText("Cap update").getAttribute("value")).toBe("1.00");
  });

  it("follows live rule changes after reverting a rule draft", () => {
    const { rerender } = render(<EditPipeModal visible initialStep={0} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Overflow" }));
    fireEvent.click(screen.getByRole("button", { name: "Pipe type" }));
    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    allPipes[1] = { ...allPipes[1], rule: "cron", cronNextDate: Date.UTC(2099, 1, 1, 5), cronInterval: { interval: 1, unit: "months" } };
    rerender(<EditPipeModal visible initialStep={0} pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Pipe type" }).textContent).toContain("Timed");
  });

  it("preserves an edited cap update while following an untouched live cron date", async () => {
    allPipes[1] = {
      ...allPipes[1],
      rule: "cron",
      capUpdateValue: 100,
      cronNextDate: Date.UTC(2099, 0, 1, 5),
      cronInterval: { interval: 1, unit: "months" }
    };
    const { rerender } = render(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Cap update"), { target: { value: "2" } });
    allPipes[1] = { ...allPipes[1], capacity: 200, cronNextDate: Date.UTC(2099, 1, 1, 5) };
    rerender(<EditPipeModal visible pipeId={id("pipe-1")} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Cap update").getAttribute("value")).toBe("2");
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(updatePipe).toHaveBeenCalledWith({
      pipeId: "pipe-1",
      ruleConfig: { rule: "cron", capUpdateValue: 200, interval: 1, unit: "months", starting: Date.UTC(2099, 1, 1, 5) }
    }));
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
