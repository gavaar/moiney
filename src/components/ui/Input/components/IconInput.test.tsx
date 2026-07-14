// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconInput } from "./IconInput";

describe("IconInput", () => {
  it("shows placeholder when no icon selected", () => {
    render(<IconInput label="Icon" value="" onSelect={() => {}} />);
    expect(screen.getByText("---")).toBeTruthy();
  });

  it("shows selected icon name when set", () => {
    render(<IconInput label="Icon" value="wallet-outline" onSelect={() => {}} />);
    expect(screen.getByText("wallet-outline")).toBeTruthy();
  });

  it("opens modal on trigger press", async () => {
    render(<IconInput label="Icon" value="" onSelect={() => {}} />);
    await userEvent.click(screen.getByTestId("icon-picker-trigger"));
    expect(screen.getByPlaceholderText("Search icons...")).toBeTruthy();
  });

  it("selects icon and calls onSelect", async () => {
    const onSelect = vi.fn();
    render(<IconInput label="Icon" value="" onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId("icon-picker-trigger"));
    const iconOption = screen.getByText("wallet-outline");
    await userEvent.click(iconOption);
    expect(onSelect).toHaveBeenCalledWith("wallet-outline");
  });

  it("shows error message", () => {
    render(<IconInput label="Icon" value="" onSelect={() => {}} error="Pick one" />);
    expect(screen.getByText("Pick one")).toBeTruthy();
  });
});
