// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render as renderComponent, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OptionListHost } from "@ui/OptionList";
import { ModalShell } from "@ui/Modal";
import { Input, type InputProps } from "../../Input";

const TextSelectInput = (props: Omit<Extract<InputProps, { type: "text-select" }>, "type">) => <Input type="text-select" {...props} />;

function render(children: ReactNode) {
  return renderComponent(<OptionListHost>{children}</OptionListHost>);
}

const defaultOptions = ["groceries", "gas", "rent"];

function ControlledWrapper({ options, initialValue }: { options?: string[]; initialValue?: string }) {
  const [value, setValue] = useState(initialValue ?? "");

  return (
    <TextSelectInput
      label="Title"
      value={value}
      onChange={setValue}
      options={options ?? defaultOptions}
      placeholder="What was this for?"
    />
  );
}

describe("TextSelectInput", () => {
  it("exposes suggestions as accessible choices and commits the chosen value", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper />);
    await user.click(screen.getByRole("textbox", { name: "Title" }));
    await user.click(screen.getByRole("button", { name: "gas" }));
    expect(screen.getByRole("textbox", { name: "Title" }).getAttribute("value")).toBe("gas");
    expect(screen.queryByRole("button", { name: "rent" })).toBeNull();
  });

  it("floats suggestions outside clipped form content while typing and selecting in one tap", async () => {
    const user = userEvent.setup();
    render(<div data-testid="clipped-form" style={{ overflow: "hidden", height: 40 }}><ControlledWrapper /></div>);
    const input = screen.getByRole("textbox", { name: "Title" });
    await user.click(input);
    expect(screen.getByText("rent")).toBeTruthy();
    expect(within(screen.getByTestId("clipped-form")).queryByText("rent")).toBeNull();
    expect(document.activeElement).toBe(input);
    await user.type(input, "g");
    expect(screen.queryByText("rent")).toBeNull();
    expect(screen.getByText("gas")).toBeTruthy();
    expect(document.activeElement).toBe(input);
    await user.click(screen.getByText("gas"));
    expect(screen.getByRole("textbox").getAttribute("value")).toBe("gas");
    expect(screen.queryByText("groceries")).toBeNull();
  });

  it("keeps suggestions in the modal's window and removes them when the modal unmounts", async () => {
    const user = userEvent.setup();
    const content = <ModalShell visible onClose={() => {}}>
      <div data-testid="modal-form" style={{ overflow: "hidden", height: 40 }}><ControlledWrapper /></div>
    </ModalShell>;
    const { container, unmount } = render(content);
    await user.click(screen.getByRole("textbox", { name: "Title" }));
    const modalWindow = screen.getByRole("textbox", { name: "Title" }).closest('[aria-modal="true"]');
    expect(modalWindow?.contains(screen.getByRole("button", { name: "gas" }))).toBe(true);
    expect(container.contains(screen.getByRole("button", { name: "gas" }))).toBe(false);
    expect(within(screen.getByTestId("modal-form")).queryByText("gas")).toBeNull();
    unmount();
    expect(screen.queryByText("gas")).toBeNull();
  });

  it("keeps typing when filtering empties the list and reopens suggestions without refocusing", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper />);
    const input = screen.getByRole("textbox", { name: "Title" });
    await user.type(input, "zzz");
    expect(screen.queryByTestId("anchored-option-list")).toBeNull();
    expect(document.activeElement).toBe(input);
    await user.clear(input);
    expect(screen.getByText("rent")).toBeTruthy();
    expect(document.activeElement).toBe(input);
  });

  it("dismisses suggestions on an outside tap without changing the draft", async () => {
    const user = userEvent.setup();
    render(<ControlledWrapper initialValue="g" />);
    await user.click(screen.getByRole("textbox", { name: "Title" }));
    await user.click(screen.getByTestId("option-list-backdrop"));
    expect(screen.queryByTestId("anchored-option-list")).toBeNull();
    expect(screen.getByRole("textbox").getAttribute("value")).toBe("g");
  });

  it("renders label and input", () => {
    render(<ControlledWrapper />);
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByPlaceholderText("What was this for?")).toBeTruthy();
  });

  it("labels the text field", () => {
    render(<ControlledWrapper />);
    expect(screen.getByRole("textbox", { name: "Title" })).toBeTruthy();
  });

  it("shows options on focus", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    expect(screen.getByText("groceries")).toBeTruthy();
    expect(screen.getByText("gas")).toBeTruthy();
    expect(screen.getByText("rent")).toBeTruthy();
  });

  it("hides options on blur", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    expect(screen.getByText("groceries")).toBeTruthy();
    fireEvent.blur(input);
    expect(screen.queryByText("groceries")).toBeNull();
  });

  it("filters options when typing", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: "gr" } });
    expect(screen.getByText("groceries")).toBeTruthy();
    expect(screen.queryByText("gas")).toBeNull();
    expect(screen.queryByText("rent")).toBeNull();
  });

  it("excludes exact match from options", () => {
    render(<ControlledWrapper initialValue="g" />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    expect(screen.getByText("groceries")).toBeTruthy();
    expect(screen.getByText("gas")).toBeTruthy();
    expect(screen.queryByText("g")).toBeNull();
    expect(screen.queryByText("rent")).toBeNull();
  });

  it("hides list when all options are filtered out", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: "xyz" } });
    expect(screen.queryByText("groceries")).toBeNull();
    expect(screen.queryByText("gas")).toBeNull();
    expect(screen.queryByText("rent")).toBeNull();
  });

  it("shows all options when input is empty", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    expect(screen.getByText("groceries")).toBeTruthy();
    expect(screen.getByText("gas")).toBeTruthy();
    expect(screen.getByText("rent")).toBeTruthy();
  });

  it("calls onChange when tapping an option and hides the list", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText(
      "What was this for?",
    ) as HTMLInputElement;
    fireEvent.focus(input);

    fireEvent.click(screen.getByText("gas"));
    expect(input.value).toBe("gas");
    expect(screen.queryByText("groceries")).toBeNull();
    expect(screen.queryByText("gas")).toBeNull();
    expect(screen.queryByText("rent")).toBeNull();
  });

  it("shows character count when maxLength is provided", () => {
    render(
      <TextSelectInput
        label="Title"
        value="Hello"
        onChange={vi.fn()}
        options={[]}
        maxLength={140}
        placeholder="What was this for?"
      />,
    );
    expect(screen.getByText("5 / 140")).toBeTruthy();
  });

  it("shows error when provided", () => {
    render(
      <TextSelectInput
        label="Title"
        value=""
        onChange={vi.fn()}
        options={[]}
        validator={() => "Something went wrong"}
        placeholder="What was this for?"
      />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(screen.getByRole("textbox"));
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("validates a committed suggestion accepted by the parent", () => {
    const validator = vi.fn((value: string) => value === "gas" ? "Unavailable" : undefined);
    function Controlled() {
      const [value, setValue] = useState("");
      return <TextSelectInput label="Title" value={value} onChange={setValue} options={["gas"]} validator={validator} />;
    }
    render(<Controlled />);
    fireEvent.focus(screen.getByRole("textbox"));
    fireEvent.click(screen.getByText("gas"));
    expect(screen.getByRole("alert").textContent).toBe("Unavailable");
    expect(validator).toHaveBeenLastCalledWith("gas");
  });

  it("input is not disabled when disabled is not set", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?") as HTMLInputElement;
    expect(input.disabled).toBeFalsy();
  });
});
