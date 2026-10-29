// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { colors } from "@/lib/styles";
import { Icon } from "./Icon";

// Exercise the dependency's real web renderer rather than the native SVG mock.
vi.mock("react-native-svg", () =>
  vi.importActual<typeof import("react-native-svg")>("react-native-svg/src/elements.web.ts"),
);

describe("internal SVG icons", () => {
  it.each([
    "boiler",
    "bomb-pipe",
    "feed-pipe",
    "instant-pipe",
    "overflow-pipe",
    "valve",
  ] as const)("renders %s at the requested size and color", name => {
    render(<Icon name={name} size={32} color="#ff0000" style={{ marginRight: 4, opacity: 0.5 }} testID="artwork" />);
    const svg = screen.getByTestId("artwork");

    expect(svg.tagName).toBe("svg");
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("height")).toBe("32");
    expect(svg.getAttribute("viewBox")).not.toBe("0 0 1254 1254");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
    expect(svg.style.marginRight).toBe("4px");
    expect(svg.style.opacity).toBe("0.5");
    expect(svg.querySelector("path[d]")).not.toBeNull();
    expect(svg.querySelector("image")).toBeNull();
    expect(svg.querySelector("g")?.getAttribute("fill")).toBe("#ff0000");
    for (const stroke of svg.querySelectorAll("[stroke]")) {
      expect(stroke.getAttribute("stroke")).toBe("#ff0000");
    }
  });

  it("defaults to the shared icon size and theme text color", () => {
    render(<Icon name="feed-pipe" testID="artwork" />);
    const svg = screen.getByTestId("artwork");

    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("height")).toBe("20");
    expect(svg.querySelector("g")?.getAttribute("fill")).toBe(colors.text);
  });

  it("updates one icon's color without affecting other instances", () => {
    const icons = <>
      <Icon name="feed-pipe" color="#ff0000" testID="first" />
      <Icon name="feed-pipe" color="#00ff00" testID="second" />
      <Icon name="valve" color="#0000ff" testID="third" />
    </>;
    const { rerender } = render(icons);

    function expectColor(testID: string, color: string) {
      const svg = screen.getByTestId(testID);
      expect(svg.querySelector("g")?.getAttribute("fill")).toBe(color);
      for (const stroke of svg.querySelectorAll("[stroke]")) {
        expect(stroke.getAttribute("stroke")).toBe(color);
      }
    }

    expectColor("first", "#ff0000");
    expectColor("second", "#00ff00");
    expectColor("third", "#0000ff");

    rerender(<>
      <Icon name="feed-pipe" color="#ff00ff" testID="first" />
      <Icon name="feed-pipe" color="#00ff00" testID="second" />
      <Icon name="valve" color="#0000ff" testID="third" />
    </>);
    expectColor("first", "#ff00ff");
    expectColor("second", "#00ff00");
    expectColor("third", "#0000ff");
  });
});
