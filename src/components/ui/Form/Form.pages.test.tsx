// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Form } from ".";

it("uses declared page order, omits empty pages, and emits fields across explicit rows", async () => {
  const onChange = vi.fn();
  const value = { name: "Ada", count: 2, accepted: true, extra: "omit" };
  render(<Form
    pages={[
      { key: 8, rows: [[{ key: "name", input: { label: "Name" } }, { key: "count", input: { type: "number", label: "Count" } }]] },
      { key: 4, rows: [[]] },
      { key: 0, rows: [[{ key: "accepted", input: { type: "checkbox", label: "Accepted" } }]] },
    ]}
    value={value}
    onChange={onChange}
  />);
  expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Count" })).toBeTruthy();
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Grace" } });
  expect(onChange).toHaveBeenLastCalledWith({ name: "Grace", count: 2, accepted: true });
  await userEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(screen.getByRole("checkbox", { name: "Accepted" })).toBeTruthy();
  expect(screen.getByLabelText("Step 2 of 2")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
});
