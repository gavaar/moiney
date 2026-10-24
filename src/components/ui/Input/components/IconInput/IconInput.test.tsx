// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input, type InputProps } from "../../Input";
import { useState, type ComponentProps } from "react";

const IconInput = (props: Omit<Extract<InputProps, { type: "icon" }>, "type">) => <Input type="icon" {...props} />;

describe("IconInput", () => {
  it("shows placeholder when no icon selected", () => {
    render(<IconInput label="Icon" value="" onChange={() => {}} />);
    expect(screen.getByText("---")).toBeTruthy();
  });

  it("hides the selected icon name in the trigger but keeps names in the picker", async () => {
    render(<IconInput label="Icon" value="wallet-outline" onChange={() => {}} />);
    expect(screen.queryByText("wallet-outline")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Icon" }));
    expect(screen.getByText("wallet-outline")).toBeTruthy();
  });

  it("labels the icon picker trigger", () => {
    render(<IconInput label="Icon" value="" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Icon" })).toBeTruthy();
  });

  it("opens modal on trigger press", async () => {
    render(<IconInput label="Icon" value="" onChange={() => {}} />);
    await userEvent.click(screen.getByTestId("icon-picker-trigger"));
    expect(screen.getByPlaceholderText("Search icons...")).toBeTruthy();
  });

  it("exposes named icon choices, their selection, and a named search field", async () => {
    render(<IconInput label="Icon" value="wallet-outline" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Icon" }));
    expect(screen.getByRole("textbox", { name: "Search icons" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Icons" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "wallet-outline", checked: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "cash-outline", checked: false })).toBeTruthy();
  });

  it("selects icon and calls onChange", async () => {
    const onChange = vi.fn();
    render(<IconInput label="Icon" value="" onChange={onChange} />);
    await userEvent.click(screen.getByTestId("icon-picker-trigger"));
    const iconOption = screen.getByText("wallet-outline");
    await userEvent.click(iconOption);
    expect(onChange).toHaveBeenCalledWith("wallet-outline");
  });

  it("validates a committed icon", async () => {
    function Controlled() {
      const [value, setValue] = useState<ComponentProps<typeof IconInput>["value"]>("");
      return <IconInput label="Icon" value={value} onChange={setValue} validator={value => value === "wallet-outline" ? "Pick one" : undefined} />;
    }
    render(<Controlled />);
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByTestId("icon-picker-trigger"));
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByText("wallet-outline"));
    expect(screen.getByText("Pick one")).toBeTruthy();
  });
});
