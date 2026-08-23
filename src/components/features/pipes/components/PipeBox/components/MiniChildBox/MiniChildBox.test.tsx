// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MiniChildBox, spentBg } from "./MiniChildBox";

describe("spentBg", () => {
  it("returns green when spent and fed are both 0", () => {
    expect(spentBg(0, 0)).toBe("rgb(70, 174, 130)");
  });

  it("returns green when spent is 0 and fed is positive", () => {
    expect(spentBg(0, 200)).toBe("rgb(70, 174, 130)");
  });

  it("returns red when fed is 0 and spent is positive", () => {
    expect(spentBg(200, 0)).toBe("rgb(192, 89, 89)");
  });

  it("returns black when spent equals fed", () => {
    expect(spentBg(200, 200)).toBe("rgb(0, 0, 0)");
  });

  it("returns green-black midpoint when spent is half of fed", () => {
    const color = spentBg(100, 200);
    expect(color).toBe("rgb(35, 87, 65)");
  });

  it("returns red when spent is double fed or more", () => {
    expect(spentBg(400, 200)).toBe("rgb(192, 89, 89)");
  });

  it("returns black-red midpoint when spent is 1.5x fed", () => {
    const color = spentBg(300, 200);
    expect(color).toBe("rgb(96, 45, 45)");
  });
});

describe("MiniChildBox", () => {
  it("renders the icon", () => {
    render(<MiniChildBox icon="cart-outline" fed={200} spent={100} />);
    expect(screen.getByTestId("mock-icon")).toBeDefined();
  });

  it("applies background color from spentBg", () => {
    const { container } = render(<MiniChildBox icon="cart-outline" fed={200} spent={200} />);
    const child = container.firstChild as HTMLElement;
    expect(child.style.backgroundColor).toBe("rgb(0, 0, 0)");
  });

  it("shows green bg when no spending", () => {
    const { container } = render(<MiniChildBox icon="cart-outline" fed={200} spent={0} />);
    const child = container.firstChild as HTMLElement;
    expect(child.style.backgroundColor).toBe("rgb(70, 174, 130)");
  });

  it("shows red bg when spent exceeds fed with no fed", () => {
    const { container } = render(<MiniChildBox icon="cart-outline" fed={0} spent={100} />);
    const child = container.firstChild as HTMLElement;
    expect(child.style.backgroundColor).toBe("rgb(192, 89, 89)");
  });


});
