import { expectTypeOf, it } from "vitest";
import type { FormField } from ".";

it("only permits inputs whose emitted values fit the field's value type", () => {
  expectTypeOf<FormField<1>["input"]>().toEqualTypeOf<never>();
  expectTypeOf<FormField<"wallet-outline" | "">["input"]>().toEqualTypeOf<never>();
  expectTypeOf<Extract<FormField<Date | null>["input"], { type: "date" }>>().not.toBeNever();
  expectTypeOf<Extract<FormField<readonly string[]>["input"], { type: "select" }>>().not.toBeNever();
});
