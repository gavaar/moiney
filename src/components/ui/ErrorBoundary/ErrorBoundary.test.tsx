// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

function ThrowingChild(): ReactNode {
  throw new Error("Broken screen");
}

describe("ErrorBoundary", () => {
  it("renders a recoverable error state", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByText("Broken screen")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
