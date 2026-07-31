// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockAlert = vi.hoisted(() => vi.fn());

vi.mock("react-native", async (importOriginal) => {
  const rn = await importOriginal<typeof import("react-native")>();
  return {
    ...rn,
    Alert: { alert: mockAlert },
  };
});

vi.mock("@ui/Icon", () => ({
  Icon: ({ name, testID }: any) => <span data-testid={testID ?? "icon"} data-name={name} />,
}));

import { RulesIcon } from "./RulesIcon";

describe("RulesIcon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders timer-outline when rule is cron", () => {
    render(<RulesIcon rule="cron" fed={0} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("timer-outline");
  });

  it("renders lock-closed-outline when fed >= capacity and rule is not cron", () => {
    render(<RulesIcon fed={100} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("lock-closed-outline");
  });

  it("renders lock-open-outline when fed < capacity", () => {
    render(<RulesIcon fed={50} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("lock-open-outline");
  });

  it("renders lock-open-outline when rule is undefined and fed < capacity", () => {
    render(<RulesIcon fed={0} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("lock-open-outline");
  });

  it("renders lock-closed-outline when fed exceeds capacity", () => {
    render(<RulesIcon fed={200} capacity={100} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("lock-closed-outline");
  });

  it("shows Rules modal open alert when tapped", async () => {
    const user = userEvent.setup();
    render(<RulesIcon fed={50} capacity={100} />);
    await user.click(screen.getByTestId("icon"));
    expect(mockAlert).toHaveBeenCalledWith("Rules", "Rules modal open");
  });

  it("shows alert on tap for cron mode too", async () => {
    const user = userEvent.setup();
    render(<RulesIcon rule="cron" fed={0} capacity={100} />);
    await user.click(screen.getByTestId("icon"));
    expect(mockAlert).toHaveBeenCalledWith("Rules", "Rules modal open");
  });
});
