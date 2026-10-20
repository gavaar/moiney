import { expectTypeOf, it } from "vitest";
import type { FormField, FormPage, FormProps } from ".";

it("only permits inputs whose emitted values fit the field's value type", () => {
  expectTypeOf<FormField<1>["input"]>().toEqualTypeOf<never>();
  expectTypeOf<FormField<"wallet-outline" | "">["input"]>().toEqualTypeOf<never>();
  expectTypeOf<Extract<FormField<Date | null>["input"], { type: "date" }>>().not.toBeNever();
  expectTypeOf<Extract<FormField<readonly string[]>["input"], { type: "select-multiple" }>>().not.toBeNever();
  expectTypeOf<Extract<FormField<readonly string[]>["input"], { type: "select" }>>().toBeNever();
  expectTypeOf<Extract<FormField<string | null>["input"], { type: "select-multiple" }>>().toBeNever();
});

it("accepts only an initial page key for navigation", () => {
  expectTypeOf<FormProps<{ name: string }>["navigationStart"]>().toEqualTypeOf<number | undefined>();
});

it("preserves field/value correlation inside explicit rows", () => {
  type Values = { name: string; accepted: boolean };
  const page: FormPage<Values> = {
    key: 8,
    rows: [
      [
        { key: "name", input: { label: "Name" } },
        { key: "accepted", input: { type: "checkbox", label: "Accepted" } },
      ]
    ]
  };
  expectTypeOf(page).toEqualTypeOf<FormPage<Values>>();
  const invalid: FormPage<Values> = {
    key: 0,
    rows: [
      [
        // @ts-expect-error A boolean field cannot use a string-emitting input.
        { key: "accepted", input: { type: "text" } },
      ]
    ]
  };
  expectTypeOf(invalid).toEqualTypeOf<FormPage<Values>>();
});
