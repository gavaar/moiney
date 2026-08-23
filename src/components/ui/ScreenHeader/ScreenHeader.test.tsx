// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScreenHeader } from "./ScreenHeader";

vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof import("react-native")>(
    "react-native",
  );

  return {
    ...actual,
    View: ({ children, className }: any) => (
      <div data-testid="screen-header-view" data-class-name={className}>
        {children}
      </div>
    ),
  };
});

describe("ScreenHeader", () => {
  it("renders injected left and right content without owning feature behavior", () => {
    render(
      <ScreenHeader
        title="History"
        left={<span data-testid="left-content">left</span>}
        right={<span data-testid="right-content">right</span>}
      />,
    );

    expect(screen.getByText("History")).toBeDefined();
    expect(screen.getByTestId("left-content")).toBeDefined();
    expect(screen.getByTestId("right-content")).toBeDefined();
  });

  it("keeps the header height stable for taller right-side controls", () => {
    render(<ScreenHeader title="Pipes" right={<span>toggle</span>} />);

    expect(
      screen.getAllByTestId("screen-header-view")[0].dataset.className,
    ).toContain("min-h-10");
  });
});
