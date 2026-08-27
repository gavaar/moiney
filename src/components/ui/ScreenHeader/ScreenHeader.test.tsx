// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScreenHeader } from "./ScreenHeader";

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
});
