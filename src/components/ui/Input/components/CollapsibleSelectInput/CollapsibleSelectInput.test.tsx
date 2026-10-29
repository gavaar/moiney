// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "../../Input";
import { OptionListHost } from "@ui/OptionList";
import { ModalShell } from "@ui/Modal";

const items = [{ id: "basic", title: "Basic" }, { id: "timed", title: "Timed" }];
function finishModalAnimation() {
  document.querySelectorAll('[aria-modal="true"]').forEach(modal => {
    let node = modal.parentElement;
    while (node && node !== document.body) {
      fireEvent.animationEnd(node); fireEvent(node, new Event("webkitAnimationEnd", { bubbles: true })); node = node.parentElement;
    }
  });
}

function Picker({ initial = null, disabled = false, onChange = vi.fn(), validator }: {
  initial?: string | null; disabled?: boolean; onChange?: (id: string) => void;
  validator?: (value: string | null) => string | undefined;
}) {
  const [value, setValue] = useState(initial);
  return <OptionListHost><Input type="collapsible-select" label="Kind" value={value}
    items={items}
    isItemDisabled={item => disabled && item.id === "timed"}
    validator={validator}
    onChange={id => { setValue(id); onChange(id); }} /></OptionListHost>;
}

describe("collapsible select through Input", () => {
  it("starts collapsed without a selection or validation error and opens on tap", () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} validator={value => value ? undefined : "Kind is required"} />);
    expect(screen.getByRole("button", { name: "Kind" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Kind options")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Kind" }));
    expect(screen.getByRole("button", { name: "Basic" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["pipe", undefined])("renders option details but only the title and optional icon in the selection (icon=%s)", icon => {
    function DetailsPicker() {
      const [value, setValue] = useState<string | null>(null);
      return <OptionListHost><Input type="collapsible-select" label="Kind" value={value} onChange={setValue}
        items={[
          { id: "basic", title: "Basic", icon, description: "Bring money into your budget." },
          { id: "minimal", title: "Title only" },
        ]} /></OptionListHost>;
    }
    render(<DetailsPicker />);
    fireEvent.click(screen.getByRole("button", { name: "Kind" }));
    expect(within(screen.getByRole("button", { name: "Basic" })).getByText("Bring money into your budget.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Basic" }));
    const selected = screen.getByRole("button", { name: "Kind" });
    expect(within(selected).getByText("Basic")).toBeTruthy();
    expect(selected.getAttribute("aria-valuetext")).toBe("Basic");
    expect(screen.queryByText("Bring money into your budget.")).toBeNull();
    fireEvent.click(selected);
    expect(screen.getByText("Bring money into your budget.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Title only" }));
    expect(within(screen.getByRole("button", { name: "Kind" })).getByText("Title only")).toBeTruthy();
  });

  it("opens group help in a popover outside the list and dismisses it without changing selection", () => {
    const onChange = vi.fn();
    const help = "Feeds bring money into your budget.";
    render(<OptionListHost><Input type="collapsible-select" label="Kind" value={null} onChange={onChange}
      items={items}
      groups={[{ id: "feeds", title: "Feeds", itemIds: ["basic", "timed"], info: help }]} /></OptionListHost>);
    fireEvent.click(screen.getByRole("button", { name: "Kind" }));
    const list = screen.getByLabelText("Kind options");
    expect(screen.queryByText(help)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About Feeds" }));
    expect(within(screen.getByTestId("popover-content")).getByText(help)).toBeTruthy();
    expect(within(list).queryByText(help)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Kind" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByTestId("popover-backdrop"));
    finishModalAnimation();
    expect(screen.queryByText(help)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Basic" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("basic");
  });

  it("keeps help available for disabled choices and closes only the popover on system Back", () => {
    const onClose = vi.fn();
    const onChange = vi.fn();
    const help = "Create a feed before adding inner pipes.";
    render(<ModalShell visible onClose={onClose}><Input type="collapsible-select" label="Kind" value={null} onChange={onChange}
      items={items} isItemDisabled={() => true}
      groups={[{ id: "inner", title: "Inner pipes", itemIds: ["basic", "timed"], info: help }]} /></ModalShell>);
    finishModalAnimation();
    fireEvent.click(screen.getByRole("button", { name: "Kind" }));
    fireEvent.click(screen.getByRole("button", { name: "About Inner pipes" }));
    finishModalAnimation();
    fireEvent.click(within(screen.getByTestId("popover-content")).getByText(help));
    expect(screen.getByText(help)).toBeTruthy();
    fireEvent.keyUp(document, { key: "Escape" });
    finishModalAnimation();
    expect(screen.queryByText(help)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Kind" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("closes and validates on the first modal-backdrop tap and dismisses on the next", () => {
    const onClose = vi.fn();
    const onChange = vi.fn();
    render(<ModalShell visible onClose={onClose}><Input type="collapsible-select" label="Kind" value={null} onChange={onChange}
      validator={value => value ? undefined : "Kind is required"}
      items={items} /></ModalShell>);
    finishModalAnimation();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Kind" }));
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.queryByRole("button", { name: "Timed" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Kind is required");
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([null, "basic"])("closes the picker before its modal on system Back (selection=%s)", value => {
    const onClose = vi.fn();
    render(<ModalShell visible onClose={onClose}><Input type="collapsible-select" label="Kind" value={value}
      validator={value => value ? undefined : "Kind is required"}
      items={items} /></ModalShell>);
    finishModalAnimation();
    fireEvent.click(screen.getByRole("button", { name: "Kind" }));
    fireEvent.keyUp(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Kind" }).getAttribute("aria-expanded")).toBe("false");
    if (value) expect(screen.queryByRole("alert")).toBeNull();
    else expect(screen.getByRole("alert").textContent).toBe("Kind is required");
    fireEvent.keyUp(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("allows empty dismissal, shows required validation, and clears the error on selection", () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} validator={value => value ? undefined : "Kind is required"} />);
    fireEvent.click(screen.getByRole("button", { name: "Kind" }));
    expect(screen.getByRole("button", { name: "Kind" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByTestId("collapsible-select-outside"));
    expect(screen.getByRole("button", { name: "Kind" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("alert").textContent).toBe("Kind is required");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Kind" }));
    expect(screen.getByRole("button", { name: "Timed" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Timed" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("timed");
    expect(screen.getByRole("button", { name: "Kind" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Kind" }).getAttribute("aria-valuetext")).toBe("Timed");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Basic" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Kind" }));
    expect(screen.getByRole("button", { name: "Basic" })).toBeTruthy();
    fireEvent.click(screen.getByTestId("collapsible-select-outside"));
    expect(screen.queryByRole("button", { name: "Basic" })).toBeNull();
  });

  it("allows an empty optional picker to close without an error or value change", () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Kind" }));
    fireEvent.click(screen.getByTestId("collapsible-select-outside"));
    expect(screen.getByRole("button", { name: "Kind" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("starts collapsed for a selected value and does not select disabled options", () => {
    const onChange = vi.fn();
    render(<Picker initial="basic" disabled onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Kind" }).textContent).toContain("Basic");
    expect(screen.queryByRole("button", { name: "Timed" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Kind" }));
    expect(screen.getByRole("button", { name: "Basic" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Timed" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Timed" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Kind" }).getAttribute("aria-expanded")).toBe("true");
  });
});
