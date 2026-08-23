// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof import("react-native")>(
    "react-native",
  );

  return {
    ...actual,
    View: ({ children, className }: any) => (
      <div data-testid="app-header-container" data-class-name={className}>
        {children}
      </div>
    ),
  };
});

vi.mock("@ui/ScreenHeader/ScreenHeader", () => ({
  ScreenHeader: ({ title, left, right }: any) => (
    <div data-testid="screen-header">
      <span>{title}</span>
      {left}
      {right}
    </div>
  ),
}));

vi.mock("./MoineyVers", () => ({
  MoineyVers: () => <span data-testid="moiney-version" />,
}));

import { AppScreenHeader } from "./AppScreenHeader";

describe("AppScreenHeader", () => {
  it("supplies the release behavior to the generic header", () => {
    render(
      <AppScreenHeader
        title="Pipes"
        right={<span data-testid="right-content">right</span>}
      />,
    );

    expect(screen.getByText("Pipes")).toBeDefined();
    expect(screen.getByTestId("moiney-version")).toBeDefined();
    expect(screen.getByTestId("right-content")).toBeDefined();
  });

  it("insets the app header consistently", () => {
    render(<AppScreenHeader title="Pipes" />);

    expect(screen.getByTestId("app-header-container").dataset.className).toBe(
      "px-4",
    );
  });
});
