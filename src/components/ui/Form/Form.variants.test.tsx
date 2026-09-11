// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { IconName } from "@ui/Icon";
import { Form, type FormProps } from ".";

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
const fields: FormProps<Values>["form"] = [
  {
    key: "amount",
    input: { type: "decimal", label: "Amount", allowNegative: false },
    validator: (value) => value.endsWith(".") ? "Finish the amount" : null,
  },
  {
    key: "date",
    input: { type: "date", label: "Date" },
    validator: (value) => value && value.getUTCDate() < 20 ? "Choose a later date" : null,
  },
  {
    key: "icon",
    input: { type: "icon", label: "Icon" },
    validator: (value) => value === "wallet-outline" ? "Choose another icon" : null,
  },
  {
    key: "source",
    input: {
      type: "select", label: "Source", items,
      renderItem: (item) => <>{item.name}</>,
    },
    validator: (value) => value === "groceries" ? "Choose an income source" : null,
  },
  {
    key: "categories",
    input: {
      type: "select", multiple: true, label: "Categories", items,
      renderItem: (item) => <>{item.name}</>,
    },
    validator: (value) => value.length < 2 ? "Choose two categories" : null,
  },
  {
    key: "title",
    input: { type: "text-select", label: "Title", options: ["groceries", "gas", "rent"] },
    validator: (value) => value.length < 3 ? "Title is too short" : null,
  },
];

function renderControlledForm() {
  const onChange = vi.fn<(value: Values) => void>();
  function ControlledForm() {
    const [value, setValue] = useState(initialValue);
    return (
      <Form
        form={fields}
        value={value}
        onChange={(nextValue) => {
          onChange(nextValue);
          setValue(nextValue);
        }}
      />
    );
  }
  render(<ControlledForm />);
  expect(screen.queryByRole("alert")).toBeNull();
  return onChange;
}

describe("Form Input variants", () => {
  it("preserves decimal drafts and validates the sanitized string on edits", () => {
    const onChange = renderControlledForm();
    const input = screen.getByRole("textbox", { name: "Amount" });
    fireEvent.change(input, { target: { value: "12." } });
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, amount: "12." });
    expect(screen.getByDisplayValue("12.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Finish the amount");

    fireEvent.change(input, { target: { value: "abc12.34xyz" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, amount: "12.34" });
    expect(screen.getByDisplayValue("12.34")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("commits calendar dates at UTC noon and clears validation after a later choice", async () => {
    const user = userEvent.setup();
    const onChange = renderControlledForm();
    await user.click(screen.getByRole("button", { name: "Date" }));
    await user.click(screen.getByTestId("day-15"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...initialValue, date: new Date(Date.UTC(2026, 6, 15, 12)),
    });
    expect(screen.getByText("15 Jul 2026")).toBeTruthy();
    expect(screen.queryByTestId("calendar-title")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Choose a later date");

    await user.click(screen.getByRole("button", { name: "Date" }));
    await user.click(screen.getByTestId("day-25"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...initialValue, date: new Date(Date.UTC(2026, 6, 25, 12)),
    });
    expect(screen.getByText("25 Jul 2026")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stores the icon selected in the real picker and validates its name", async () => {
    const user = userEvent.setup();
    const onChange = renderControlledForm();
    const trigger = screen.getByRole("button", { name: "Icon" });
    await user.click(trigger);
    await user.click(screen.getByText("wallet-outline"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...initialValue, icon: "wallet-outline" });
    expect(within(trigger).getByText("wallet-outline")).toBeTruthy();
    // jsdom does not run CSS animations; complete the modal's browser animation events.
    let animatedElement = screen.getByPlaceholderText("Search icons...").parentElement;
    while (animatedElement && animatedElement !== document.body) {
      fireEvent.animationEnd(animatedElement);
      fireEvent(animatedElement, new Event("webkitAnimationEnd", { bubbles: true }));
      animatedElement = animatedElement.parentElement;
    }
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Search icons...")).toBeNull();
    });
    expect(screen.getByRole("alert").textContent).toBe("Choose another icon");
  });

  it("stores single-select IDs, updates the trigger, and validates replacement selections", async () => {
    const user = userEvent.setup();
    const onChange = renderControlledForm();
    const trigger = screen.getByRole("button", { name: "Source" });
    await user.click(trigger);
    await user.click(screen.getByText("Groceries"));
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, source: "groceries" });
    expect(trigger.textContent).toContain("Groceries");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("alert").textContent).toBe("Choose an income source");

    await user.click(trigger);
    await user.click(screen.getByText("Salary"));
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, source: "salary" });
    expect(trigger.textContent).toContain("Salary");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("accumulates and removes multiple-select IDs while keeping the options open", async () => {
    const user = userEvent.setup();
    const onChange = renderControlledForm();
    const trigger = screen.getByRole("button", { name: "Categories" });
    await user.click(trigger);
    const groceries = screen.getByRole("checkbox", { name: "Groceries" });
    const salary = screen.getByRole("checkbox", { name: "Salary" });
    await user.click(groceries);
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, categories: ["groceries"] });
    expect(screen.getByRole("alert").textContent).toBe("Choose two categories");
    await user.click(salary);
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, categories: ["groceries", "salary"] });
    expect(groceries.getAttribute("aria-checked")).toBe("true");
    expect(salary.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("2 selected")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(groceries);
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, categories: ["salary"] });
    expect(groceries.getAttribute("aria-checked")).toBe("false");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Choose two categories");
  });

  it("validates typed text and suggested options while preserving earlier field edits", async () => {
    const user = userEvent.setup();
    const onChange = renderControlledForm();
    fireEvent.change(screen.getByRole("textbox", { name: "Amount" }), {
      target: { value: "25.50" },
    });
    const title = screen.getByRole("textbox", { name: "Title" });
    await user.click(title);
    await user.type(title, "gr");
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, amount: "25.50", title: "gr" });
    expect(screen.getByRole("alert").textContent).toBe("Title is too short");
    expect(screen.getByText("groceries")).toBeTruthy();
    expect(screen.queryByText("gas")).toBeNull();
    expect(screen.queryByText("rent")).toBeNull();

    fireEvent.click(screen.getByText("groceries"));
    expect(onChange).toHaveBeenLastCalledWith({ ...initialValue, amount: "25.50", title: "groceries" });
    expect(screen.getByDisplayValue("groceries")).toBeTruthy();
    expect(screen.queryByText("groceries")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
