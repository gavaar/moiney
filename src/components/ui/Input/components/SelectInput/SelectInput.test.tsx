// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectInput } from "./SelectInput";

const items = [
  { id: "1", name: "Groceries" },
  { id: "2", name: "Salary" },
] as const;

describe("SelectInput", () => {
  it("groups inline options with independently collapsible accessible headers", async () => {
    const onChange = vi.fn();
    render(<SelectInput presentation="inline" label="Source" value={null} onChange={onChange}
      items={[{ id: "none", name: "None" }, ...items]}
      groups={[
        { id: "bank", name: "Bank", itemIds: ["1"], initiallyExpanded: true },
        { id: "wallet", name: "Wallet", itemIds: ["2"] },
      ]}
      renderItem={item => <>{item.name}</>} />);
    expect(screen.getByRole("radio", { name: "None" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse Bank" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("radio", { name: "Salary" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Expand Wallet" }));
    expect(screen.getByRole("radio", { name: "Salary" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Groceries" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Collapse Bank" }));
    expect(screen.queryByRole("radio", { name: "Groceries" })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "Salary" }));
    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("expands modal groups and keeps the selected label in the trigger", async () => {
    function Controlled() {
      const [value, setValue] = useState<string | null>(null);
      return <SelectInput label="Payer" value={value} onChange={setValue} items={items}
        groups={[{ id: "bank", name: "Bank", itemIds: ["1"] }, { id: "wallet", name: "Wallet", itemIds: ["2"], initiallyExpanded: true }]}
        renderItem={item => <>{item.name}</>} />;
    }
    render(<Controlled />);
    await userEvent.click(screen.getByRole("button", { name: "Payer" }));
    expect(screen.queryByRole("button", { name: "Groceries" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Expand Bank" }));
    await userEvent.click(screen.getByRole("button", { name: "Groceries" }));
    expect(screen.getByRole("button", { name: "Payer" }).textContent).toBe("Groceries");
  });
  it("renders inline custom items and exposes the controlled selection without a picker modal", async () => {
    function Controlled({ disabled = false }: { disabled?: boolean }) {
      const [value, setValue] = useState<string | null>("1");
      return <SelectInput presentation="inline" label="Owner" items={items}
        renderItem={item => <>{item.name}</>} value={value} onChange={setValue} disabled={disabled} />;
    }
    const { rerender } = render(<Controlled />);
    expect(screen.queryByTestId("select-trigger")).toBeNull();
    expect(screen.queryByTestId("modal-backdrop")).toBeNull();
    expect(screen.getByRole("radio", { name: "Groceries" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: "Salary" }));
    expect(screen.getByRole("radio", { name: "Salary" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Groceries" }).getAttribute("aria-checked")).toBe("false");
    rerender(<Controlled disabled />);
    fireEvent.click(screen.getByRole("radio", { name: "Groceries" }));
    expect(screen.getByRole("radio", { name: "Salary" }).getAttribute("aria-checked")).toBe("true");
  });

  it("selects multiple options without closing the option list", async () => {
    const user = userEvent.setup();

    function MultiSelectHarness() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <SelectInput
          multiple
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
      return <SelectInput multiple label="Pipes" items={items} renderItem={item => <>{item.name}</>} value={value} onChange={setValue} validator={value => value.length < 2 ? "Pick two" : undefined} />;
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
