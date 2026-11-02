// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./Input";
import { ModalShell } from "@ui/Modal";

function finishModalAnimation() {
  document.querySelectorAll('[aria-modal="true"]').forEach(modal => {
    let node = modal.parentElement;
    while (node && node !== document.body) {
      fireEvent.animationEnd(node);
      fireEvent(node, new Event("webkitAnimationEnd", { bubbles: true }));
      node = node.parentElement;
    }
  });
}

describe("Input keyboard interaction", () => {
  it.each([
    { type: "text", value: "" },
    { type: "number", value: 0 },
    { type: "decimal", value: "" },
    { type: "text-select", value: "", options: ["First"] },
    { type: "icon", value: "" },
  ] as const)("keeps composing Escape in the $type editor rather than dismissing a layer", async props => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ModalShell visible onClose={onClose}><Input {...props} label="Field" onChange={() => {}} /></ModalShell>);
    finishModalAnimation();
    if (props.type === "icon") {
      await user.click(screen.getByRole("button", { name: "Field" }));
      finishModalAnimation();
    }
    const input = screen.getByRole("textbox", { name: props.type === "icon" ? "Search icons" : "Field" });
    fireEvent.keyUp(input, { key: "Escape", isComposing: true });
    expect(onClose).not.toHaveBeenCalled();
    expect(input.isConnected).toBe(true);
    if (props.type === "text-select") expect(screen.getByRole("button", { name: "First" })).toBeTruthy();
  });

  it.each(["checkbox", "icon", "select-multiple", "toggle"] as const)("activates a %s choice once with Space", async type => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    if (type === "checkbox") {
      render(<Input type="checkbox" label="Acknowledge" value={false} onChange={onChange} />);
    } else if (type === "icon") {
      render(<Input type="icon" label="Icon" value="" onChange={onChange} />);
      await user.click(screen.getByRole("button", { name: "Icon" }));
    } else if (type === "toggle") {
      render(<Input type="toggle" label="Mode" value={false} onChange={onChange}
        options={[{ label: "First", icon: "cash-outline" }, { label: "Second", icon: "wallet-outline" }]} />);
    } else {
      render(<Input type="select-multiple" label="Pipes" value={[]} onChange={onChange}
        items={[{ id: "one" }]} renderItem={() => <>First pipe</>} />);
      await user.click(screen.getByRole("button", { name: "Pipes" }));
    }
    const choice = type === "icon"
      ? screen.getByRole("radio", { name: "cash-outline" })
      : type === "toggle" ? screen.getByRole("radio", { name: "Second" })
      : screen.getByRole("checkbox", { name: type === "checkbox" ? "Acknowledge" : "First pipe" });
    act(() => choice.focus());
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(type === "icon" ? "cash-outline" : type === "select-multiple" ? ["one"] : true);
  });

  it.each(["icon", "date", "select", "select-multiple"] as const)("opens %s from the keyboard, focuses its content, and returns focus on Escape and commit", async type => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    if (type === "icon") {
      render(<Input type="icon" label="Picker" value="" onChange={onChange} />);
    } else if (type === "date") {
      render(<Input type="date" label="Picker" value={null} onChange={onChange} />);
    } else if (type === "select") {
      render(<Input type="select" label="Picker" value={null} onChange={onChange}
        items={[{ id: "one" }]} renderItem={() => <>First pipe</>} />);
    } else {
      render(<Input type="select-multiple" label="Picker" value={[]} onChange={onChange}
        items={[{ id: "one" }]} renderItem={() => <>First pipe</>} />);
    }
    const trigger = screen.getByRole("button", { name: "Picker" });
    await user.tab();
    expect(document.activeElement).toBe(trigger);
    await user.keyboard("{Enter}");
    finishModalAnimation();
    const initialFocus = () => type === "icon"
      ? screen.getByRole("textbox", { name: "Search icons" })
      : screen.getByRole(type === "select-multiple" ? "checkbox" : "button", { name: type === "date" ? "Previous month" : "First pipe" });
    expect(document.activeElement).toBe(initialFocus());
    await user.keyboard("{Escape}");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard(" ");
    finishModalAnimation();
    if (type === "icon") {
      await user.type(initialFocus(), "cash-outline");
      act(() => screen.getByRole("radio", { name: "cash-outline" }).focus());
    } else if (type === "date") {
      act(() => screen.getByRole("button", { name: "Choose today" }).focus());
    }
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledOnce();
    if (type === "select-multiple") await user.keyboard("{Escape}");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("contains Tab traversal in the picker without focusing its backdrop", async () => {
    const user = userEvent.setup();
    render(<Input type="icon" label="Icon" value="" onChange={() => {}} />);
    await user.tab();
    await user.keyboard("{Enter}");
    finishModalAnimation();
    const search = screen.getByRole("textbox", { name: "Search icons" });
    await user.type(search, "cash-outline");
    const choice = screen.getByRole("radio", { name: "cash-outline" });
    act(() => choice.focus());
    await user.tab();
    expect(document.activeElement).toBe(search);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(choice);
  });
});
