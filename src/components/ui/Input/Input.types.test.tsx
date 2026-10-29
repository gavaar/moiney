import { expectTypeOf, it } from "vitest";
import type { ReactElement } from "react";
import { Input } from ".";

const items = [{ id: "one", name: "First", balance: 100 }] as const;
type Item = (typeof items)[number];

it("preserves readonly item types in single-select rendering and styling", () => {
  expectTypeOf(<Input type="select" items={items} value={null}
    renderItem={item => {
      expectTypeOf(item).toEqualTypeOf<Item>();
      // @ts-expect-error Renderers cannot read properties absent from the items.
      expectTypeOf(item.missing);
      return item.name;
    }}
    itemStyle={item => {
      expectTypeOf(item).toEqualTypeOf<Item>();
      return { opacity: item.balance > 0 ? 1 : 0.5 };
    }}
    onChange={id => { expectTypeOf(id).toEqualTypeOf<string>(); }}
  />).toMatchTypeOf<ReactElement>();
});

it("preserves item types independently of the multiple-select value type", () => {
  expectTypeOf(<Input type="select-multiple" items={items} value={[]}
    renderItem={item => {
      expectTypeOf(item).toEqualTypeOf<Item>();
      // @ts-expect-error Renderers cannot read properties absent from the items.
      expectTypeOf(item.missing);
      return item.name;
    }}
    itemStyle={item => {
      expectTypeOf(item).toEqualTypeOf<Item>();
      return { opacity: item.balance > 0 ? 1 : 0.5 };
    }}
    onChange={ids => { expectTypeOf(ids).toEqualTypeOf<string[]>(); }}
    validator={ids => {
      expectTypeOf(ids).toEqualTypeOf<readonly string[]>();
      return undefined;
    }}
  />).toMatchTypeOf<ReactElement>();
});
