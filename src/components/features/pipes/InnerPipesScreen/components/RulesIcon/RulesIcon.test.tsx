// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Id } from "@convex/_generated/dataModel";

vi.mock("@ui/Icon", () => ({
  Icon: ({ name, testID, color }: any) => (
    <span data-testid={testID ?? "icon"} data-name={name} data-color={color} />
  ),
}));

let lastRuleModalProps: any;
vi.mock("./RuleModal", () => ({
  RuleModal: (props: any) => {
    lastRuleModalProps = props;
    return props.visible ? <div data-testid="rule-modal" /> : null;
  },
}));

import { RulesIcon } from "./RulesIcon";

const pId = (id: string) => id as Id<"pipes">;

describe("RulesIcon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastRuleModalProps = undefined;
  });

  it("renders timer-outline when rule is cron", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="cron" fed={0} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("timer-outline");
  });

  it("renders pipe-disconnected when rule is any_spend", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="any_spend" fed={50} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("pipe-disconnected");
  });

  it("renders pipe-leak when rule is spend_overflow", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="spend_overflow" fed={50} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("pipe-leak");
  });

  it("shows the rule icon instead of a lock when the pipe is full", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="any_spend" fed={100} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("pipe-disconnected");
  });

  it("tints the icon secondary when fed >= capacity, even for cron", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="cron" fed={100} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-color")).toBe("#4D94CC");
  });

  it("uses the text color for rule icons when below capacity", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="spend_overflow" fed={50} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-color")).toBe("#F8F8F8");
  });

  it("renders lock-closed-outline when there is no rule and fed >= capacity", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} fed={100} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("lock-closed-outline");
  });

  it("renders lock-open-outline when fed < capacity", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} fed={50} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("lock-open-outline");
  });

  it("renders lock-open-outline when rule is undefined and fed < capacity", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} fed={0} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("lock-open-outline");
  });

  it("renders lock-closed-outline when fed exceeds capacity", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} fed={200} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("lock-closed-outline");
  });

  it("opens the rule modal with the pipeId when tapped", async () => {
    const user = userEvent.setup();
    render(
      <RulesIcon pipeId={pId("pipe-1")} rule="spend_overflow" fed={50} capacity={100} />,
    );
    await user.click(screen.getByTestId("icon"));
    expect(screen.getByTestId("rule-modal")).toBeTruthy();
    expect(lastRuleModalProps.visible).toBe(true);
    expect(lastRuleModalProps.pipeId).toBe(pId("pipe-1"));
  });

  it("opens the modal on tap for cron mode too", async () => {
    const user = userEvent.setup();
    render(<RulesIcon pipeId={pId("pipe-1")} rule="cron" fed={0} capacity={100} />);
    await user.click(screen.getByTestId("icon"));
    expect(screen.getByTestId("rule-modal")).toBeTruthy();
  });

  it("renders a muted pipe icon when disabled", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} disabled fed={0} capacity={100} />);
    const icon = screen.getByTestId("rules-icon-placeholder");
    expect(icon.getAttribute("data-name")).toBe("pipe");
    expect(icon.getAttribute("data-color")).toBe("#9CA3AF");
    expect(screen.queryByTestId("rule-modal")).toBeNull();
  });

  it("does not open the rule modal when a disabled icon is tapped", async () => {
    const user = userEvent.setup();
    render(<RulesIcon pipeId={pId("pipe-1")} disabled fed={0} capacity={100} />);
    await user.click(screen.getByTestId("rules-icon-placeholder"));
    expect(screen.queryByTestId("rule-modal")).toBeNull();
  });

  it("closes the rule modal when onClose is invoked", async () => {
    const user = userEvent.setup();
    render(<RulesIcon pipeId={pId("pipe-1")} fed={50} capacity={100} />);
    await user.click(screen.getByTestId("icon"));
    expect(screen.getByTestId("rule-modal")).toBeTruthy();

    act(() => lastRuleModalProps.onClose());
    expect(screen.queryByTestId("rule-modal")).toBeNull();
  });
});
