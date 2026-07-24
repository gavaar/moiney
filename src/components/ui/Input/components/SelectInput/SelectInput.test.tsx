// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectInput } from "./SelectInput";

const items = [
  { id: "1", name: "Groceries" },
  { id: "2", name: "Salary" },
] as const;

describe("SelectInput", () => {
  it("shows label", () => {
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("From")).toBeTruthy();
  });

  it("shows placeholder when no value selected", () => {
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onSelect={() => {}}
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
        onSelect={() => {}}
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
        onSelect={() => {}}
      />,
    );
    await user.click(screen.getByTestId("select-trigger"));
    expect(screen.getByText("Groceries")).toBeTruthy();
    expect(screen.getByText("Salary")).toBeTruthy();
  });

  it("calls onSelect with item id on item tap", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByTestId("select-trigger"));
    await user.click(screen.getByText("Salary"));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("shows selected item in trigger after selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByTestId("select-trigger"));
    await user.click(screen.getByText("Salary"));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("shows error message", () => {
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onSelect={() => {}}
        error="Select a source"
      />,
    );
    expect(screen.getByText("Select a source")).toBeTruthy();
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    render(
      <SelectInput
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onSelect={() => {}}
        disabled
      />,
    );
    await user.click(screen.getByTestId("select-trigger"));
    expect(screen.queryByText("Groceries")).toBeNull();
  });
});