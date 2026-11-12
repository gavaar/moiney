// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MiniBar } from "./MiniBar";

describe("MiniBar", () => {
  it("scales positive spent, fed, and capacity segments to the group maximum", () => {
    render(<MiniBar fed={80} spent={20} capacity={100} maxVal={100} />);

    expect(screen.getByTestId("mini-bar-spent").style.width).toBe("20%");
    expect(screen.getByTestId("mini-bar-fed").style.width).toBe("60%");
    expect(screen.getByTestId("mini-bar-capacity").style.width).toBe("20%");
  });
});
