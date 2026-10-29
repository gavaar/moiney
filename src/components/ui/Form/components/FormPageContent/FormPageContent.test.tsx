// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { IconName } from "@ui/Icon";
import { formBuilder } from "../../form-builder";
import { FormPageContent } from "./FormPageContent";

type Values = { icon: IconName | ""; name: string };

describe("Form row columns", () => {
  it.each([
    [undefined, undefined],
    [undefined, 2],
    [undefined, 0.5],
    [0.25, 0.25],
    [0.1, 0.2],
  ])("constrains long descriptions to proportional columns with growth %s / %s", (iconGrow, nameGrow) => {
    const { input, row } = formBuilder<Values>();
    const value: Values = { icon: "pipe", name: "Example" };
    const description = "A long description that must wrap beneath its own input without widening its column.";
    const fields = row(
      input("icon", { type: "icon", label: "Icon" }, { grow: iconGrow }),
      input("name", { label: "Name" }, { description, grow: nameGrow }),
    );
    const { container } = render(<FormPageContent
      rows={[fields]}
      value={value}
      onChange={() => {}}
      onError={() => {}}
    />);
    const [iconColumn, nameColumn] = Array.from(container.firstElementChild!.children);
    expect(nameColumn.contains(screen.getByText(description))).toBe(true);
    expect(iconColumn.contains(screen.getByText(description))).toBe(false);

    // jsdom cannot measure widths; verify the constraints supplied to the layout engine.
    const styles = [getComputedStyle(iconColumn), getComputedStyle(nameColumn)];
    const growths = styles.map(style => Number(style.flexGrow));
    expect(growths[0] / growths[1]).toBeCloseTo((iconGrow ?? 1) / (nameGrow ?? 1));
    expect(growths[0] + growths[1]).toBeGreaterThanOrEqual(1);
    for (const style of styles) {
      expect(style.width).toBe("0px");
      expect(style.flexBasis).toBe("0px");
      expect(style.flexShrink).toBe("1");
      expect(style.minWidth).toBe("0px");
    }
  });

  it("fills a single-field row even with fractional growth", () => {
    const { input, row } = formBuilder<{ name: string }>();
    const { container } = render(<FormPageContent
      rows={[row(input("name", { label: "Name" }, { grow: 0.5 }))]}
      value={{ name: "Example" }}
      onChange={() => {}}
      onError={() => {}}
    />);
    const column = container.firstElementChild!.firstElementChild!;
    expect(Number(getComputedStyle(column).flexGrow)).toBeGreaterThanOrEqual(1);
  });
});
