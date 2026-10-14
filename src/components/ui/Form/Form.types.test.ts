import { expectTypeOf, it } from "vitest";
import type { FormField, FormNavigation, FormPage, FormProps } from ".";

it("only permits inputs whose emitted values fit the field's value type", () => {
  expectTypeOf<FormField<1>["input"]>().toEqualTypeOf<never>();
  expectTypeOf<FormField<"wallet-outline" | "">["input"]>().toEqualTypeOf<never>();
  expectTypeOf<Extract<FormField<Date | null>["input"], { type: "date" }>>().not.toBeNever();
  expectTypeOf<Extract<FormField<readonly string[]>["input"], { type: "select" }>>().not.toBeNever();
});

it("requires a complete controlled navigation configuration", () => {
  expectTypeOf<FormProps<{ name: string }>["navigation"]>().toEqualTypeOf<FormNavigation | undefined>();
  // @ts-expect-error A controlled page needs a callback to accept navigation requests.
  const missingCallback: FormNavigation = { step: 0 };
  // @ts-expect-error A callback without a selected page is not controlled navigation.
  const missingStep: FormNavigation = { onChange: () => {} };
  expectTypeOf(missingCallback).toEqualTypeOf<FormNavigation>();
  expectTypeOf(missingStep).toEqualTypeOf<FormNavigation>();
});

it("preserves field/value correlation inside explicit rows", () => {
  type Values = { name: string; accepted: boolean };
  const page: FormPage<Values> = { key: 8, rows: [[
    { key: "name", input: { label: "Name" } },
    { key: "accepted", input: { type: "checkbox", label: "Accepted" } },
  ]] };
  expectTypeOf(page).toEqualTypeOf<FormPage<Values>>();
  const invalid: FormPage<Values> = { key: 0, rows: [[
    // @ts-expect-error A boolean field cannot use a string-emitting input.
    { key: "accepted", input: { type: "text" } },
  ]] };
  expectTypeOf(invalid).toEqualTypeOf<FormPage<Values>>();
});
