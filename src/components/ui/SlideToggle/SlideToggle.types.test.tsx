import { expectTypeOf, it } from "vitest";
import type { ReactElement } from "react";
import { SlideToggle } from ".";

const options = [
  { value: "bar", label: "Bar view", icon: "align-horizontal-left" },
  { value: "tree", label: "Tree view", icon: "file-tree" },
] as const;

it("preserves option values through selection and accepts readonly options", () => {
  expectTypeOf(<SlideToggle options={options} value="bar" onChange={value => {
    expectTypeOf(value).toEqualTypeOf<"bar" | "tree">();
  }} />).toMatchTypeOf<ReactElement>();

  // @ts-expect-error The controlled selection must come from the options.
  expectTypeOf(<SlideToggle options={options} value="other" onChange={() => {}} />).toMatchTypeOf<ReactElement>();
});
