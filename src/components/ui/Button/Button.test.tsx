// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

vi.mock("@ui/Icon", () => ({
  Icon: ({ name, size, testID }: any) => (
    <span data-testid={testID ?? "icon"} data-name={name} data-size={size} />
  ),
}));

describe("Button", () => {
  it("renders title", () => {
    render(<Button title="Run now" onPress={() => {}} />);
    expect(screen.getByText("Run now")).toBeTruthy();
  });

  it("renders icon when icon prop is provided", () => {
    render(<Button title="Run now" icon="water-outline" onPress={() => {}} />);
    const icon = screen.getByTestId("icon");
    expect(icon.getAttribute("data-name")).toBe("water-outline");
  });

  it("does not render icon when icon prop is absent", () => {
    render(<Button title="Run now" onPress={() => {}} />);
    expect(screen.queryByTestId("icon")).toBeNull();
  });
});
