// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { type Id } from "@convex/_generated/dataModel";
import { computeElapsedIntervals } from "@convex/lib/pipes";

const h = vi.hoisted(() => ({
  api: {
    pipes: {
      updatePipeRule: { kind: "updatePipeRule" },
      executePipeRuleNow: { kind: "executePipeRuleNow" },
    },
  },
  updatePipeRule: vi.fn(),
  executePipeRuleNow: vi.fn(),
  showAlert: { success: vi.fn(), error: vi.fn() },
  usePipeSelection: vi.fn(),
}));

vi.mock("@convex/_generated/api", () => ({ api: h.api }));
vi.mock("convex/react", () => ({
  useMutation: (ref: any) =>
    ref === h.api.pipes.updatePipeRule ? h.updatePipeRule : h.executePipeRuleNow,
}));
vi.mock("@ui/Alert", () => ({ useAlert: () => h.showAlert }));
vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => h.usePipeSelection(),
}));

import { RuleModal } from "./RuleModal";

const pId = (id: string) => id as Id<"pipes">;

function basePipe(overrides: Record<string, unknown> = {}) {
  return {
    _id: pId("pipe-1"),
    name: "Groceries",
    icon: "cart-outline",
    rule: undefined,
    capacity: 0,
    fed: 0,
    spent: 0,
    ...overrides,
  };
}

function renderModal(pipe: any, onClose = () => {}) {
  h.usePipeSelection.mockReturnValue({ pipesById: { "pipe-1": pipe } });
  return render(
    <RuleModal visible pipeId={pId("pipe-1")} onClose={onClose} />,
  );
}

async function clickAndFlush(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe("RuleModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.updatePipeRule.mockResolvedValue(undefined);
    h.executePipeRuleNow.mockResolvedValue(undefined);
  });

  it("renders pipe name and the four rule options", () => {
    renderModal(basePipe());
    expect(screen.getByText("Groceries")).toBeTruthy();

    fireEvent.click(screen.getAllByTestId("select-trigger")[0]);
    expect(screen.getByText("Any spend")).toBeTruthy();
    expect(screen.getByText("Spend overflow")).toBeTruthy();
    expect(screen.getByText("Cron")).toBeTruthy();
    expect(screen.getAllByText("No rule").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the description for the selected rule", () => {
    renderModal(basePipe());
    expect(
      screen.getByText("No automatic rule. This pipe behaves like a regular pipe."),
    ).toBeTruthy();

    fireEvent.click(screen.getAllByTestId("select-trigger")[0]);
    fireEvent.click(screen.getByText("Any spend"));
    expect(
      screen.getByText("Reacts every time money is spent from this pipe."),
    ).toBeTruthy();
  });

  it("initializes the select and cron fields from the pipe", () => {
    renderModal(
      basePipe({
        rule: "cron",
        capUpdateValue: 100,
        cronInterval: { interval: 2, unit: "years" },
        cronNextDate: Date.UTC(2026, 5, 15, 12),
      }),
    );
    expect(screen.getAllByText("Cron").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByDisplayValue("100")).toBeTruthy();
    expect(screen.getByDisplayValue("2")).toBeTruthy();
    expect(screen.getAllByText("Year").length).toBeGreaterThanOrEqual(1);
  });

  it("shows cron fields only when cron is selected", () => {
    renderModal(basePipe());
    expect(screen.queryByText("Cap update")).toBeNull();

    fireEvent.click(screen.getAllByTestId("select-trigger")[0]);
    fireEvent.click(screen.getByText("Cron"));

    expect(screen.getByText("Cap update")).toBeTruthy();
    expect(screen.getByText("Interval")).toBeTruthy();
    expect(screen.getByText("Unit")).toBeTruthy();
    expect(screen.getByText("Starting date")).toBeTruthy();
  });

  it("hides cap update for non-cron rules", () => {
    renderModal(basePipe());
    fireEvent.click(screen.getAllByTestId("select-trigger")[0]);
    fireEvent.click(screen.getByText("Any spend"));
    expect(screen.queryByText("Cap update")).toBeNull();
  });

  it("shows Run now with water icon when nothing changed and rule is not cron", async () => {
    renderModal(basePipe());
    expect(screen.getByText("Run now")).toBeTruthy();
    expect(document.querySelector('[name="water-outline"]')).toBeTruthy();

    await clickAndFlush(screen.getByText("Run now"));

    expect(h.executePipeRuleNow).toHaveBeenCalledWith({ pipeId: pId("pipe-1") });
    expect(h.showAlert.success).toHaveBeenCalledWith("Rule executed");
  });

  it("closes the modal after Run now succeeds", async () => {
    const onClose = vi.fn();
    renderModal(basePipe(), onClose);
    await clickAndFlush(screen.getByText("Run now"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls updatePipeRule with any_spend and keeps the modal open", async () => {
    const onClose = vi.fn();
    renderModal(basePipe(), onClose);
    fireEvent.click(screen.getAllByTestId("select-trigger")[0]);
    fireEvent.click(screen.getByText("Any spend"));

    await clickAndFlush(screen.getByText("Save rule"));

    expect(h.updatePipeRule).toHaveBeenCalledWith({
      pipeId: pId("pipe-1"),
      rule: "any_spend",
      capUpdateValue: undefined,
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clears the rule when saving No rule", async () => {
    renderModal(basePipe({ rule: "cron" }));
    fireEvent.click(screen.getAllByTestId("select-trigger")[0]);
    fireEvent.click(screen.getByText("No rule"));

    await clickAndFlush(screen.getByText("Save rule"));

    expect(h.updatePipeRule).toHaveBeenCalledWith({
      pipeId: pId("pipe-1"),
      rule: undefined,
    });
  });

  it("saves a cron rule with interval, unit, starting, and capUpdateValue and closes", async () => {
    const onClose = vi.fn();
    renderModal(
      basePipe({
        rule: "cron",
        capUpdateValue: 50,
        cronInterval: { interval: 1, unit: "months" },
        cronNextDate: Date.UTC(2026, 0, 15, 12),
      }),
      onClose,
    );

    fireEvent.click(screen.getByTestId("increment-button"));

    await clickAndFlush(screen.getByText("Save rule"));

    expect(h.updatePipeRule).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeId: pId("pipe-1"),
        rule: "cron",
        interval: 2,
        unit: "months",
        capUpdateValue: 50,
        starting: expect.any(Number),
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("does not run or save when an unchanged cron rule is open", async () => {
    renderModal(
      basePipe({
        rule: "cron",
        capUpdateValue: 50,
        cronInterval: { interval: 1, unit: "months" },
        cronNextDate: Date.UTC(2026, 0, 15, 12),
      }),
    );
    expect(screen.getByText("Save rule")).toBeTruthy();

    await clickAndFlush(screen.getByText("Save rule"));

    expect(h.updatePipeRule).not.toHaveBeenCalled();
    expect(h.executePipeRuleNow).not.toHaveBeenCalled();
  });

  it("shows the cap credit warning for cron with past starting and non-zero cap", () => {
    renderModal(
      basePipe({
        rule: "cron",
        capUpdateValue: 50,
        cronInterval: { interval: 1, unit: "months" },
        cronNextDate: Date.UTC(2026, 0, 15, 12),
      }),
    );
    const starting = new Date(Date.UTC(2026, 0, 15, 12));
    const elapsed = computeElapsedIntervals(starting.getTime(), 1, "months");
    const credit = (elapsed * 50).toFixed(2);
    expect(
      screen.getByText(
        `saving this rule will automatically add ${credit} cap to account for the ${elapsed} months that have passed from the starting date`,
      ),
    ).toBeTruthy();
  });

  it("updates the warning when cap update changes", () => {
    renderModal(
      basePipe({
        rule: "cron",
        capUpdateValue: 50,
        cronInterval: { interval: 1, unit: "months" },
        cronNextDate: Date.UTC(2026, 0, 15, 12),
      }),
    );
    const starting = new Date(Date.UTC(2026, 0, 15, 12));
    const elapsed = computeElapsedIntervals(starting.getTime(), 1, "months");

    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "100" },
    });

    expect(
      screen.getByText(
        `saving this rule will automatically add ${(elapsed * 100).toFixed(2)} cap to account for the ${elapsed} months that have passed from the starting date`,
      ),
    ).toBeTruthy();
  });

  it("hides the warning when cap update is zero", () => {
    renderModal(
      basePipe({
        rule: "cron",
        capUpdateValue: 50,
        cronInterval: { interval: 1, unit: "months" },
        cronNextDate: Date.UTC(2026, 0, 15, 12),
      }),
    );
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "0" },
    });
    expect(screen.queryByText(/saving this rule will automatically add/)).toBeNull();
  });

  it("hides the warning when starting is in the future", () => {
    renderModal(
      basePipe({
        rule: "cron",
        capUpdateValue: 50,
        cronInterval: { interval: 1, unit: "months" },
        cronNextDate: Date.UTC(2099, 0, 15, 12),
      }),
    );
    expect(screen.queryByText(/saving this rule will automatically add/)).toBeNull();
  });

  it("shows an error alert and stays open when saving fails", async () => {
    h.updatePipeRule.mockRejectedValue(new Error("boom"));
    const onClose = vi.fn();
    renderModal(basePipe({ rule: "any_spend" }), onClose);

    fireEvent.click(screen.getAllByTestId("select-trigger")[0]);
    fireEvent.click(screen.getByText("No rule"));

    await clickAndFlush(screen.getByText("Save rule"));

    expect(h.showAlert.error).toHaveBeenCalledWith("boom");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows an error alert and stays open when Run now fails", async () => {
    h.executePipeRuleNow.mockRejectedValue(new Error("nope"));
    const onClose = vi.fn();
    renderModal(basePipe(), onClose);

    await clickAndFlush(screen.getByText("Run now"));

    expect(h.showAlert.error).toHaveBeenCalledWith("nope");
    expect(onClose).not.toHaveBeenCalled();
  });
});
