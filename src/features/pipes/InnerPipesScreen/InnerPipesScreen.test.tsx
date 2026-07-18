// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InnerPipesScreen } from './InnerPipesScreen';

describe("InnerPipesScreen", () => {
  it("renders the selected pipe name", () => {
    render(<InnerPipesScreen name="Groceries" onDeselect={vi.fn()} />);
    expect(screen.getByText(/selected Groceries/i)).toBeDefined();
  });

  it("calls onDeselect when back button is pressed", async () => {
    const user = userEvent.setup();
    const onDeselect = vi.fn();
    render(<InnerPipesScreen name="Groceries" onDeselect={onDeselect} />);
    await user.click(screen.getByTestId("back-button"));
    expect(onDeselect).toHaveBeenCalledOnce();
  });
});
