// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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

let lastRingProps: any;
vi.mock("@ui/ProgressRing", () => ({
  ProgressRing: (props: any) => {
    lastRingProps = props;
    return <span data-testid="progress-ring" />;
  },
}));

import { RulesIcon } from "./RulesIcon";

const pId = (id: string) => id as Id<"pipes">;

describe("RulesIcon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastRuleModalProps = undefined;
    lastRingProps = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders timer-outline when rule is cron", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="cron" fed={0} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("timer-outline");
  });

  it("renders pipe-disconnected when rule is instant_settlement", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="instant_settlement" fed={50} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("pipe-disconnected");
  });

  it("renders pipe-leak when rule is spend_overflow", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="spend_overflow" fed={50} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("pipe-leak");
  });

  it("shows the rule icon instead of a lock when the pipe is full", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="instant_settlement" fed={100} capacity={100} />);
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

  it("wraps the disabled placeholder in the same-sized box as the enabled icon", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} disabled fed={0} capacity={100} />);
    const box = screen.getByTestId("rules-icon-box");
    const icon = screen.getByTestId("rules-icon-placeholder");
    expect(box.contains(icon)).toBe(true);
  });

  it("wraps the rule icon in the same-sized box", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="cron" fed={0} capacity={100} />);
    const box = screen.getByTestId("rules-icon-box");
    const icon = screen.getByTestId("icon");
    expect(box.contains(icon)).toBe(true);
  });

  it("renders a ring for spend_overflow reflecting spent/capacity", () => {
    render(
      <RulesIcon
        pipeId={pId("pipe-1")}
        rule="spend_overflow"
        fed={50}
        capacity={100}
        spent={50}
      />,
    );
    expect(screen.getByTestId("progress-ring")).toBeTruthy();
    expect(lastRingProps.progress).toBeCloseTo(0.5, 5);
  });

  it("clamps the spend_overflow ring to full once spent exceeds capacity", () => {
    render(
      <RulesIcon
        pipeId={pId("pipe-1")}
        rule="spend_overflow"
        fed={50}
        capacity={100}
        spent={150}
      />,
    );
    expect(lastRingProps.progress).toBe(1);
  });

  it("renders a ring for cron showing time elapsed in the interval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 6, 6, 12));

    render(
      <RulesIcon
        pipeId={pId("pipe-1")}
        rule="cron"
        fed={0}
        capacity={100}
        cronNextDate={Date.UTC(2026, 6, 10, 12)}
        cronInterval={{ interval: 7, unit: "days" }}
      />,
    );
    expect(screen.getByTestId("progress-ring")).toBeTruthy();
    expect(lastRingProps.progress).toBeCloseTo(71 / 144, 5);
  });

  it("renders an empty ring on the cron day once the rule has executed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 6, 10, 6));

    render(
      <RulesIcon
        pipeId={pId("pipe-1")}
        rule="cron"
        fed={0}
        capacity={100}
        cronNextDate={Date.UTC(2026, 6, 10, 5)}
        cronInterval={{ interval: 7, unit: "days" }}
      />,
    );
    expect(screen.getByTestId("progress-ring")).toBeTruthy();
    expect(lastRingProps.progress).toBe(0);
  });

  it("renders no ring for instant_settlement", () => {
    render(
      <RulesIcon pipeId={pId("pipe-1")} rule="instant_settlement" fed={50} capacity={100} />,
    );
    expect(screen.queryByTestId("progress-ring")).toBeNull();
  });

  it("renders no ring when there is no rule", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} fed={50} capacity={100} />);
    expect(screen.queryByTestId("progress-ring")).toBeNull();
  });

  it("renders no ring for spend_overflow when capacity is not positive", () => {
    render(
      <RulesIcon
        pipeId={pId("pipe-1")}
        rule="spend_overflow"
        fed={0}
        capacity={0}
        spent={50}
      />,
    );
    expect(screen.queryByTestId("progress-ring")).toBeNull();
  });

  it("renders no ring for cron when cronNextDate is missing", () => {
    render(<RulesIcon pipeId={pId("pipe-1")} rule="cron" fed={0} capacity={100} />);
    expect(screen.queryByTestId("progress-ring")).toBeNull();
  });

  it("tints the ring with the icon color", () => {
    render(
      <RulesIcon
        pipeId={pId("pipe-1")}
        rule="spend_overflow"
        fed={100}
        capacity={100}
        spent={50}
      />,
    );
    expect(lastRingProps.color).toBe("#4D94CC");
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
