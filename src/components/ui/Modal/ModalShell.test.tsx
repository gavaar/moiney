// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModalShell } from "./ModalShell";

describe("ModalShell", () => {
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

  it("calls onClose when the backdrop is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ModalShell visible onClose={onClose}>
        <div>modal content</div>
      </ModalShell>,
    );
    await user.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when content is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ModalShell visible onClose={onClose}>
        <div data-testid="modal-content">modal content</div>
      </ModalShell>,
    );
    await user.click(screen.getByTestId("modal-content"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
