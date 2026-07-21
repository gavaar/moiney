// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Liquidity } from "./Liquidity";
import { colors } from "@/lib/styles";

// Convert "#RRGGBB" to the "rgb(r, g, b)" format react-native-web produces in jsdom
function hexToRgb(hex: string) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// Convert "#RRGGBB" + alpha hex (e.g. "BF") to the "rgba(r, g, b, a)" format
// jsdom rounds alpha to 2 decimal places
function hexToRgba(hex: string, alphaHex: string) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const a = Math.round((Number.parseInt(alphaHex, 16) / 255) * 100) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const primaryRgb = hexToRgb(colors.primary);
const secondaryRgb = hexToRgb(colors.secondary);
const surfaceRgba = hexToRgba(colors.surface, "CC");
const errorRgba = hexToRgba(colors.error, "CC");
const primaryBgRgba = hexToRgba(colors.primary, "11");

describe("Liquidity", () => {
  describe("conditional rendering", () => {
    it("renders all three bars when all values are non-zero", () => {
      render(<Liquidity fed={100} capacity={80} spent={40} />);
      expect(screen.getByTestId("fed-bar")).toBeDefined();
      expect(screen.getByTestId("spent-bar")).toBeDefined();
      expect(screen.getByTestId("capacity-bar")).toBeDefined();
    });

    it("hides fed bar when fed is 0", () => {
      render(<Liquidity fed={0} capacity={80} spent={40} />);
      expect(screen.queryByTestId("fed-bar")).toBeNull();
      expect(screen.getByTestId("spent-bar")).toBeDefined();
      expect(screen.getByTestId("capacity-bar")).toBeDefined();
    });

    it("hides spent bar when spent is 0", () => {
      render(<Liquidity fed={100} capacity={80} spent={0} />);
      expect(screen.getByTestId("fed-bar")).toBeDefined();
      expect(screen.queryByTestId("spent-bar")).toBeNull();
      expect(screen.getByTestId("capacity-bar")).toBeDefined();
    });

    it("hides capacity bar when capacity is 0", () => {
      render(<Liquidity fed={100} capacity={0} spent={40} />);
      expect(screen.getByTestId("fed-bar")).toBeDefined();
      expect(screen.getByTestId("spent-bar")).toBeDefined();
      expect(screen.queryByTestId("capacity-bar")).toBeNull();
    });

    it("renders empty view when all values are 0", () => {
      render(<Liquidity fed={0} capacity={0} spent={0} />);
      expect(screen.getByTestId("liquidity")).toBeDefined();
      expect(screen.queryByTestId("fed-bar")).toBeNull();
      expect(screen.queryByTestId("spent-bar")).toBeNull();
      expect(screen.queryByTestId("capacity-bar")).toBeNull();
    });
  });

  describe("FedBar overfed behavior", () => {
    it("renders overfed segment when fed exceeds capacity", () => {
      render(<Liquidity fed={100} capacity={60} spent={30} />);
      const overfed = screen.getByTestId("fed-bar-overfed");
      expect(overfed.style.flexGrow).not.toBe("0");
      expect(overfed.style.backgroundColor).toBe(secondaryRgb);
    });

    it("does not render visible overfed segment when fed <= capacity", () => {
      render(<Liquidity fed={50} capacity={100} spent={30} />);
      const overfed = screen.getByTestId("fed-bar-overfed");
      expect(overfed.style.flexGrow).toBe("0");
    });

    it("renders fed-filled with primary color", () => {
      render(<Liquidity fed={100} capacity={80} spent={30} />);
      const filled = screen.getByTestId("fed-bar-filled");
      expect(filled.style.backgroundColor).toBe(primaryRgb);
    });
  });

  describe("SpentBar color logic", () => {
    it("uses error color when spent exceeds fed", () => {
      render(<Liquidity fed={50} capacity={200} spent={100} />);
      const spentFilled = screen.getByTestId("spent-bar-filled");
      expect(spentFilled.style.backgroundColor).toBe(errorRgba);
    });

    it("uses surface color when spent <= fed", () => {
      render(<Liquidity fed={100} capacity={200} spent={40} />);
      const spentFilled = screen.getByTestId("spent-bar-filled");
      expect(spentFilled.style.backgroundColor).toBe(surfaceRgba);
    });
  });

  describe("CapacityBar styling", () => {
    it("renders with dashed border and primary-tinted background", () => {
      render(<Liquidity fed={50} capacity={100} spent={30} />);
      const capFilled = screen.getByTestId("capacity-bar-filled");
      expect(capFilled.style.borderTopStyle).toBe("dashed");
      expect(capFilled.style.borderRightStyle).toBe("dashed");
      expect(capFilled.style.borderBottomStyle).toBe("dashed");
      expect(capFilled.style.borderLeftStyle).toBe("dashed");
      expect(capFilled.style.borderRightWidth).toBe("2px");
      expect(capFilled.style.backgroundColor).toBe(primaryBgRgba);
    });
  });

  describe("proportional widths", () => {
    it("scales bars relative to biggest value", () => {
      render(<Liquidity fed={100} capacity={150} spent={50} />);
      const biggest = 150;
      const fedFilled = screen.getByTestId("fed-bar-filled");
      const spentFilled = screen.getByTestId("spent-bar-filled");
      const capFilled = screen.getByTestId("capacity-bar-filled");

      expect(capFilled.style.flexGrow).toBe(String(150 / biggest));
      expect(fedFilled.style.flexGrow).toBe(String(100 / biggest));
      expect(spentFilled.style.flexGrow).toBe(String(50 / biggest));
    });

    it("uses spent as biggest when it exceeds fed and capacity", () => {
      render(<Liquidity fed={30} capacity={50} spent={100} />);
      const biggest = 100;
      const spentFilled = screen.getByTestId("spent-bar-filled");
      const fedFilled = screen.getByTestId("fed-bar-filled");
      const capFilled = screen.getByTestId("capacity-bar-filled");

      expect(spentFilled.style.flexGrow).toBe(String(100 / biggest));
      expect(fedFilled.style.flexGrow).toBe(String(30 / biggest));
      expect(capFilled.style.flexGrow).toBe(String(50 / biggest));
    });

    it("uses capacity as biggest when it exceeds fed and spent", () => {
      render(<Liquidity fed={30} capacity={100} spent={50} />);
      const biggest = 100;
      const capFilled = screen.getByTestId("capacity-bar-filled");
      const fedFilled = screen.getByTestId("fed-bar-filled");
      const spentFilled = screen.getByTestId("spent-bar-filled");

      expect(capFilled.style.flexGrow).toBe(String(100 / biggest));
      expect(fedFilled.style.flexGrow).toBe(String(30 / biggest));
      expect(spentFilled.style.flexGrow).toBe(String(50 / biggest));
    });
  });

  describe("overfed + spent > fed combination", () => {
    it("shows overfed segment in secondary color and spent bar in error color", () => {
      render(<Liquidity fed={100} capacity={60} spent={120} />);
      const overfed = screen.getByTestId("fed-bar-overfed");
      const spentFilled = screen.getByTestId("spent-bar-filled");

      expect(overfed.style.flexGrow).not.toBe("0");
      expect(overfed.style.backgroundColor).toBe(secondaryRgb);
      expect(spentFilled.style.backgroundColor).toBe(errorRgba);
    });
  });
});
