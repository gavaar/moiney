// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Liquidity } from "./Liquidity";

describe("Liquidity", () => {
  it("extends actual spending with a separate possible-coverage segment", () => {
    render(<Liquidity fed={10000} capacity={10000} spent={4000} coverageProvidedCents={4000} />);
    expect(screen.getByTestId("spent-bar").style.width).toBe("40%");
    const coverage = screen.getByTestId("coverage-provided-bar");
    expect(coverage.style.left).toBe("40%");
    expect(coverage.style.width).toBe("40%");
    expect(screen.getByTestId("fed-bar").style.width).toBe("100%");
  });

  it.each([0, 10000, 12000])("does not show a coverage segment without available coverage at spent %s", spent => {
    render(<Liquidity fed={10000} capacity={10000} spent={spent} coverageProvidedCents={0} />);
    expect(screen.queryByTestId("coverage-provided-bar")).toBeNull();
  });

  it("shows coverage without actual spending", () => {
    render(<Liquidity fed={10000} capacity={10000} spent={0} coverageProvidedCents={4000} />);
    expect(screen.queryByTestId("spent-bar")).toBeNull();
    expect(screen.getByTestId("coverage-provided-bar").style.left).toBe("0%");
    expect(screen.getByTestId("coverage-provided-bar").style.width).toBe("40%");
  });
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
    });

    it("does not render visible overfed segment when fed <= capacity", () => {
      render(<Liquidity fed={50} capacity={100} spent={30} />);
      expect(screen.queryByTestId("fed-bar-overfed")).toBeNull();
    });

  });

  describe("proportional widths", () => {
    it("scales bars relative to biggest value", () => {
      render(<Liquidity fed={100} capacity={150} spent={50} />);
      const biggest = 150;
      const fedBar = screen.getByTestId("fed-bar");
      const spentBar = screen.getByTestId("spent-bar");
      const capBar = screen.getByTestId("capacity-bar");

      expect(capBar.style.width).toBe(`${(150 / biggest) * 100}%`);
      expect(fedBar.style.width).toBe(`${(100 / biggest) * 100}%`);
      expect(spentBar.style.width).toBe(`${(50 / biggest) * 100}%`);
    });

    it("uses spent as biggest when it exceeds fed and capacity", () => {
      render(<Liquidity fed={30} capacity={50} spent={100} />);
      const biggest = 100;
      const spentBar = screen.getByTestId("spent-bar");
      const fedBar = screen.getByTestId("fed-bar");
      const capBar = screen.getByTestId("capacity-bar");

      expect(spentBar.style.width).toBe(`${(100 / biggest) * 100}%`);
      expect(fedBar.style.width).toBe(`${(30 / biggest) * 100}%`);
      expect(capBar.style.width).toBe(`${(50 / biggest) * 100}%`);
    });

    it("uses capacity as biggest when it exceeds fed and spent", () => {
      render(<Liquidity fed={30} capacity={100} spent={50} />);
      const biggest = 100;
      const capBar = screen.getByTestId("capacity-bar");
      const fedBar = screen.getByTestId("fed-bar");
      const spentBar = screen.getByTestId("spent-bar");

      expect(capBar.style.width).toBe(`${(100 / biggest) * 100}%`);
      expect(fedBar.style.width).toBe(`${(30 / biggest) * 100}%`);
      expect(spentBar.style.width).toBe(`${(50 / biggest) * 100}%`);
    });
  });
});
