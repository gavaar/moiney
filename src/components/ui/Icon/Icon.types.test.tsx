import { expectTypeOf, it } from "vitest";
import type { ReactElement } from "react";
import { Icon, safeIconName, type IconName } from ".";

it("accepts supported icon names and requires normalization for external names", () => {
  expectTypeOf<IconName>().not.toEqualTypeOf<string>();
  expectTypeOf(<Icon name="pipe" />).toMatchTypeOf<ReactElement>();
  expectTypeOf(<Icon name={safeIconName("external-name")} />).toMatchTypeOf<ReactElement>();
  // @ts-expect-error Unsupported names must not reach the renderer.
  expectTypeOf(<Icon name="unknown-icon" />).toMatchTypeOf<ReactElement>();
  // @ts-expect-error The fallback must also be supported.
  safeIconName(null, "unknown-icon");
});
