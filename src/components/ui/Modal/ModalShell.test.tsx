// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModalShell } from "./ModalShell";

describe("ModalShell", () => {
  it("renders an interactive bottom accessory without dismissing", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(<ModalShell visible onClose={onClose} bottomAccessory={<button onClick={onSelect}>Select mode</button>}>
      <div>content</div>
    </ModalShell>);
    await userEvent.click(screen.getByText("Select mode"));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });
  it("renders children when visible", () => {
    render(
      <ModalShell visible onClose={() => {}}>
        <div>modal content</div>
      </ModalShell>,
    );
    expect(screen.getByText("modal content")).toBeDefined();
  });

  it("does not render children when not visible", () => {
    render(
      <ModalShell visible={false} onClose={() => {}}>
        <div>modal content</div>
      </ModalShell>,
    );
    expect(screen.queryByText("modal content")).toBeNull();
  });

  it.each(["wide", "content"] as const)("calls onClose when the %s modal backdrop is pressed", async width => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ModalShell visible onClose={onClose} width={width}>
        <div>modal content</div>
      </ModalShell>,
    );
    await user.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(["wide", "content"] as const)("does not call onClose when %s modal content is pressed", async width => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ModalShell visible onClose={onClose} width={width}>
        <div data-testid="modal-content">modal content</div>
      </ModalShell>,
    );
    await user.click(screen.getByTestId("modal-content"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
