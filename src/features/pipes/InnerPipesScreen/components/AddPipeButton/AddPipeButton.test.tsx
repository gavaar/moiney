// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddPipeButton } from "./AddPipeButton";

describe("AddPipeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("renders the add pipe button", () => {
    render(<AddPipeButton />);
    expect(screen.getByText("Add pipe")).toBeDefined();
  });

  it("opens modal with form fields on tap", async () => {
    const user = userEvent.setup();
    render(<AddPipeButton />);

    await user.click(screen.getByText("Add pipe"));

    expect(screen.getByPlaceholderText("Pipe name")).toBeDefined();
    expect(screen.getByText("Submit")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("resets form fields when cancel is pressed", async () => {
    const user = userEvent.setup();
    render(<AddPipeButton />);

    await user.click(screen.getByText("Add pipe"));

    const nameInput = screen.getByPlaceholderText("Pipe name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByText("Cancel"));

    await user.click(screen.getByText("Add pipe"));

    const reopenedInput = screen.getByPlaceholderText("Pipe name") as HTMLInputElement;
    expect(reopenedInput.value).toBe("");
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    render(<AddPipeButton />);

    await user.click(screen.getByText("Add pipe"));
    await user.click(screen.getByText("Submit"));

    expect(screen.getByText("Name is required")).toBeDefined();
  });

  it("shows validation error when name is less than 3 characters", async () => {
    const user = userEvent.setup();
    render(<AddPipeButton />);

    await user.click(screen.getByText("Add pipe"));

    const nameInput = screen.getByPlaceholderText("Pipe name");
    await user.type(nameInput, "ab");

    await user.click(screen.getByText("Submit"));

    expect(
      screen.getByText("Name must be at least 3 characters"),
    ).toBeDefined();
  });

  it("logs form data to console on valid submit", async () => {
    const user = userEvent.setup();
    render(<AddPipeButton />);

    await user.click(screen.getByText("Add pipe"));

    const nameInput = screen.getByPlaceholderText("Pipe name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith({
        name: "Food",
        icon: "pipe",
        description: undefined,
        priority: 0,
        capacity: undefined,
      });
    });
  });

  it("clears validation error when user types after failed submit", async () => {
    const user = userEvent.setup();
    render(<AddPipeButton />);

    await user.click(screen.getByText("Add pipe"));
    await user.click(screen.getByText("Submit"));

    expect(screen.getByText("Name is required")).toBeDefined();

    const nameInput = screen.getByPlaceholderText("Pipe name");
    await user.type(nameInput, "F");

    expect(screen.queryByText("Name is required")).toBeNull();
  });
});
