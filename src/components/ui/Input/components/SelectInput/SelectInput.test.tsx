// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input, type InputProps } from "../../Input";

const SelectInput = <Item extends { id: string },>(props: Omit<Extract<InputProps<Item>, { type: "select" }>, "type">) => <Input type="select" {...props} />;
const SelectMultipleInput = <Item extends { id: string },>(props: Omit<Extract<InputProps<Item>, { type: "select-multiple" }>, "type">) => <Input type="select-multiple" {...props} />;

const items = [
  { id: "1", name: "Groceries" },
  { id: "2", name: "Salary" },
] as const;

describe("SelectInput", () => {
  it("keeps tree selection independent from collapse and remembers hidden selections on reopen", async () => {
    const onChange = vi.fn();
    const treeItems = [
      { id: "root", name: "Budget" },
      { id: "parent", name: "Bills" },
      { id: "leaf", name: "Rent" },
    ];
    function Controlled() {
      const [value, setValue] = useState<string[]>([]);
      return <SelectMultipleInput label="Tree pipes" value={value}
        onChange={next => { onChange(next); setValue(next); }} items={treeItems}
        tree={[
          { id: "root", label: "Budget", selectable: false },
          { id: "parent", label: "Bills", parentId: "root", selectable: true },
          { id: "leaf", label: "Rent", parentId: "parent", selectable: true },
        ]}
        renderItem={item => <>{item.name}</>} />;
    }
    const rendered = render(<Controlled />);
    await userEvent.click(screen.getByRole("button", { name: "Tree pipes" }));
    expect(screen.queryByRole("checkbox", { name: "Budget" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Rent" })).toBeTruthy();
    await userEvent.click(screen.getByRole("checkbox", { name: "Bills" }));
    expect(onChange).toHaveBeenLastCalledWith(["parent"]);
    expect(screen.getByRole("checkbox", { name: "Rent" }).getAttribute("aria-checked")).toBe("false");
    await userEvent.click(screen.getByRole("checkbox", { name: "Rent" }));
    await userEvent.click(screen.getByRole("button", { name: "Collapse Bills" }));
    expect(screen.queryByRole("checkbox", { name: "Rent" })).toBeNull();
    expect(screen.getByLabelText("1 selected inside")).toBeTruthy();
    expect(onChange).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByTestId("modal-backdrop"));
    await userEvent.click(screen.getByRole("button", { name: "Tree pipes" }));
    expect(screen.queryByRole("checkbox", { name: "Rent" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Expand Bills" }));
    expect(screen.getByRole("checkbox", { name: "Rent" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Collapse Budget" }));
    expect(screen.queryByRole("checkbox", { name: "Bills" })).toBeNull();
    expect(screen.getByLabelText("2 selected inside")).toBeTruthy();
    expect(onChange).toHaveBeenCalledTimes(2);
    rendered.unmount();
    render(<Controlled />);
    await userEvent.click(screen.getByRole("button", { name: "Tree pipes" }));
    expect(screen.getByRole("checkbox", { name: "Rent" })).toBeTruthy();
  });

  it("keeps available tree choices in their supplied order without changing accessible names", async () => {
    const onChange = vi.fn();
    render(<SelectInput label="Source" value={null} onChange={onChange} items={[{ id: "bank", name: "Bank" }, ...items]}
      tree={[
        { id: "bank", label: "Bank", selectable: false },
        { id: "2", label: "Salary", parentId: "bank", selectable: true },
        { id: "1", label: "Groceries", parentId: "bank", selectable: true },
        { id: "missing", label: "Missing", parentId: "bank", selectable: true },
      ]}
      renderItem={item => <>{item.name}</>} />);
    await userEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(screen.getAllByRole("button", { name: /^(Salary|Groceries)$/ }).map(row => row.textContent)).toEqual(["Salary", "Groceries"]);
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Salary" }));
    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("collapses independent roots while keeping standalone options available", async () => {
    const onChange = vi.fn();
    render(<SelectInput label="Source" value={null} onChange={onChange}
      items={[{ id: "none", name: "None" }, { id: "bank", name: "Bank" }, { id: "wallet", name: "Wallet" }, ...items]}
      tree={[
        { id: "none", label: "None", selectable: true },
        { id: "bank", label: "Bank", selectable: false },
        { id: "1", label: "Groceries", parentId: "bank", selectable: true },
        { id: "wallet", label: "Wallet", selectable: false },
        { id: "2", label: "Salary", parentId: "wallet", selectable: true },
      ]}
      renderItem={item => <>{item.name}</>} />);
    await userEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(screen.getByRole("button", { name: "None" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse Bank" }).getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Collapse Wallet" }));
    expect(screen.queryByRole("button", { name: "Salary" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Expand Wallet" }));
    expect(screen.getByRole("button", { name: "Salary" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Groceries" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Collapse Bank" }));
    expect(screen.queryByRole("button", { name: "Groceries" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Salary" }));
    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("keeps a selected tree item's label in the trigger", async () => {
    function Controlled() {
      const [value, setValue] = useState<string | null>(null);
      return <SelectInput label="Payer" value={value} onChange={setValue} items={[{ id: "bank", name: "Bank" }, ...items]}
        tree={[
          { id: "bank", label: "Bank", selectable: false },
          { id: "1", label: "Groceries", parentId: "bank", selectable: true },
          { id: "2", label: "Salary", selectable: true },
        ]}
        renderItem={item => <>{item.name}</>} />;
    }
    render(<Controlled />);
    await userEvent.click(screen.getByRole("button", { name: "Payer" }));
    await userEvent.click(screen.getByRole("button", { name: "Collapse Bank" }));
    expect(screen.queryByRole("button", { name: "Groceries" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Expand Bank" }));
    await userEvent.click(screen.getByRole("button", { name: "Groceries" }));
    expect(screen.getByRole("button", { name: "Payer" }).textContent).toBe("Groceries");
  });
  it("renders custom items in the picker and preserves the controlled selection when disabled", async () => {
    function Controlled({ disabled = false }: { disabled?: boolean }) {
      const [value, setValue] = useState<string | null>("1");
      return <SelectInput label="Owner" items={items}
        renderItem={item => <>{item.name}</>} value={value} onChange={setValue} disabled={disabled} />;
    }
    const { rerender } = render(<Controlled />);
    expect(screen.getByRole("button", { name: "Owner" }).textContent).toBe("Groceries");
    expect(screen.queryByTestId("modal-backdrop")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Owner" }));
    await userEvent.click(screen.getByRole("button", { name: "Salary" }));
    expect(screen.getByRole("button", { name: "Owner" }).textContent).toBe("Salary");
    expect(screen.getByRole("button", { name: "Owner" }).getAttribute("aria-expanded")).toBe("false");
    rerender(<Controlled disabled />);
    fireEvent.click(screen.getByRole("button", { name: "Owner" }));
    expect(screen.getByRole("button", { name: "Owner" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Owner" }).textContent).toBe("Salary");
  });

  it("selects multiple options without closing the option list", async () => {
    const user = userEvent.setup();

    function MultiSelectHarness() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <SelectMultipleInput
          label="Pipes"
          items={items}
          renderItem={(item) => <>{item.name}</>}
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<MultiSelectHarness />);
    await user.click(screen.getByRole("button", { name: "Pipes" }));
    await user.click(screen.getByRole("checkbox", { name: "Groceries" }));
    await user.click(screen.getByRole("checkbox", { name: "Salary" }));

    expect(screen.getByRole("checkbox", { name: "Groceries" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "Salary" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByText("2 selected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pipes" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("shows label", () => {
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("From")).toBeTruthy();
  });

  it("labels the select trigger and exposes its expanded state", () => {
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "From" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("shows placeholder when no value selected", () => {
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onChange={() => {}}
        placeholder="Pick one"
      />,
    );
    expect(screen.getByText("Pick one")).toBeTruthy();
  });

  it("shows selected item content when value matches an item", () => {
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value="1"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Groceries")).toBeTruthy();
  });

  it("opens modal on trigger press", async () => {
    const user = userEvent.setup();
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onChange={() => {}}
      />,
    );
    await user.click(screen.getByTestId("select-trigger"));
    expect(screen.getByText("Groceries")).toBeTruthy();
    expect(screen.getByText("Salary")).toBeTruthy();
  });

  it("calls onChange with item id on item tap", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId("select-trigger"));
    await user.click(screen.getByText("Salary"));
    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("shows selected item in trigger after selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId("select-trigger"));
    await user.click(screen.getByText("Salary"));
    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("validates a committed single selection", async () => {
    function Controlled() {
      const [value, setValue] = useState<string | null>(null);
      return <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={value}
        onChange={setValue}
        validator={value => value === "1" ? "Select a source" : undefined}
      />;
    }
    render(<Controlled />);
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByTestId("select-trigger"));
    await userEvent.click(screen.getByText("Groceries"));
    expect(screen.getByText("Select a source")).toBeTruthy();
  });

  it("validates multiple selections on close, then corrects errors while open", async () => {
    function Controlled() {
      const [value, setValue] = useState<string[]>([]);
      return <SelectMultipleInput label="Pipes" items={items} renderItem={item => <>{item.name}</>} value={value} onChange={setValue} validator={value => value.length < 2 ? "Pick two" : undefined} />;
    }
    render(<Controlled />);
    await userEvent.click(screen.getByTestId("select-trigger"));
    await userEvent.click(screen.getByRole("checkbox", { name: "Groceries" }));
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.getByRole("alert").textContent).toBe("Pick two");
    await userEvent.click(screen.getByTestId("select-trigger"));
    await userEvent.click(screen.getByRole("checkbox", { name: "Salary" }));
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByRole("checkbox", { name: "Salary" }));
    expect(screen.getByRole("alert").textContent).toBe("Pick two");
    await userEvent.click(screen.getByTestId("modal-backdrop"));
    expect(screen.getByRole("alert").textContent).toBe("Pick two");
  });

  it("does not open when disabled", () => {
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onChange={() => {}}
        disabled
      />,
    );
    fireEvent.click(screen.getByTestId("select-trigger"));
    expect(screen.queryByText("Groceries")).toBeNull();
  });
});
