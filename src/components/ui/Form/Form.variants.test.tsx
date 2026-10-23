// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { IconName } from "@ui/Icon";
import { Form, type FormRow } from ".";
import { OptionListHost } from "@ui/OptionList";

type Values = {
  amount: string;
  date: Date | null;
  icon: IconName | "";
  source: string | null;
  categories: string[];
  title: string;
};

const initialValue: Values = {
  amount: "",
  date: new Date(Date.UTC(2026, 6, 21, 12)),
  icon: "",
  source: null,
  categories: [],
  title: "",
};
const items = [
  { id: "groceries", name: "Groceries" },
  { id: "salary", name: "Salary" },
];
const fields: FormRow<Values> = [
  {
    key: "amount",
    input: {
      type: "decimal",
      label: "Amount",
      allowNegative: false,
      validator: (value) => value.endsWith(".") ? "Finish the amount" : undefined
    },
  },
  {
    key: "date",
    input: {
      type: "date",
      label: "Date",
      validator: (value) => value && value.getUTCDate() < 20 ? "Choose a later date" : undefined
    },
  },
  {
    key: "icon",
    input: {
      type: "icon",
      label: "Icon",
      validator: (value) => value === "wallet-outline" ? "Choose another icon" : undefined
    },
  },
  {
    key: "source",
    input: {
      type: "select",
      label: "Source",
      items,
      renderItem: (item) => <>{item.name}</>,
      validator: (value) => value === "groceries" ? "Choose an income source" : undefined,
    },
  },
  {
    key: "categories",
    input: {
      type: "select-multiple",
      label: "Categories",
      items,
      renderItem: (item) => <>{item.name}</>,
      validator: (value) => value.length < 2 ? "Choose two categories" : undefined,
    },
  },
  {
    key: "title",
    input: {
      type: "text-select",
      label: "Title",
      options: ["groceries", "gas", "rent"],
      validator: (value) => value.length < 3 ? "Title is too short" : undefined
    },
  },
];

function renderControlledForm() {
  const onChange = vi.fn<(value: Values) => void>();
  function ControlledForm() {
    const [value, setValue] = useState(initialValue);
    return (
      <Form
        pages={[{ key: 0, rows: fields.map(field => [field]) }]}
        value={value}
        onChange={(nextValue) => {
          onChange(nextValue);
          setValue(nextValue);
        }}
      />
    );
  }
  render(<OptionListHost><ControlledForm /></OptionListHost>);
  expect(screen.queryByRole("alert")).toBeNull();
  return onChange;
}

describe("Form Input variants", () => {
  it("binds decimal drafts to their configured key", () => {
    const onChange = renderControlledForm();
    const input = screen.getByRole("textbox", { name: "Amount" });
    fireEvent.change(input, { target: { value: "12." } });
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, amount: "12." });
    expect(screen.getByDisplayValue("12.")).toBeTruthy();
    fireEvent.blur(input);
    expect(screen.getByRole("alert").textContent).toBe("Finish the amount");
  });

  it("binds date selections without changing other configured values", async () => {
    const user = userEvent.setup();
    const onChange = renderControlledForm();
    await user.click(screen.getByRole("button", { name: "Date" }));
    await user.click(screen.getByTestId("day-15"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...initialValue, date: new Date(Date.UTC(2026, 6, 15, 12)),
    });
    expect(screen.getByRole("alert").textContent).toBe("Choose a later date");
  });

  it("binds icon selections to their configured key", async () => {
    const user = userEvent.setup();
    const onChange = renderControlledForm();
    const trigger = screen.getByRole("button", { name: "Icon" });
    await user.click(trigger);
    await user.click(screen.getByText("wallet-outline"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...initialValue, icon: "wallet-outline" });
    expect(screen.getByRole("alert").textContent).toBe("Choose another icon");
  });

  it("binds single-select IDs to their configured key", async () => {
    const user = userEvent.setup();
    const onChange = renderControlledForm();
    const trigger = screen.getByRole("button", { name: "Source" });
    await user.click(trigger);
    await user.click(screen.getByText("Groceries"));
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, source: "groceries" });
    expect(screen.getByRole("alert").textContent).toBe("Choose an income source");
  });

  it("binds multiple-select arrays without replacing other configured values", async () => {
    const user = userEvent.setup();
    const onChange = renderControlledForm();
    const trigger = screen.getByRole("button", { name: "Categories" });
    await user.click(trigger);
    const groceries = screen.getByRole("checkbox", { name: "Groceries" });
    const salary = screen.getByRole("checkbox", { name: "Salary" });
    await user.click(groceries);
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, categories: ["groceries"] });
    await user.click(salary);
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, categories: ["groceries", "salary"] });
  });

  it("binds typed text and suggestions while preserving earlier field edits", async () => {
    const user = userEvent.setup();
    const onChange = renderControlledForm();
    fireEvent.change(screen.getByRole("textbox", { name: "Amount" }), {
      target: { value: "25.50" },
    });
    const title = screen.getByRole("textbox", { name: "Title" });
    await user.click(title);
    await user.type(title, "gr");
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, amount: "25.50", title: "gr" });

    fireEvent.click(screen.getByText("groceries"));
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, amount: "25.50", title: "groceries" });
  });
});
