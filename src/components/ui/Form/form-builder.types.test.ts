import { expectTypeOf, it } from "vitest";
import type { FormPage, FormProps } from "./form.types";
import { formBuilder } from "./form-builder";

type Draft = {
  name: string;
  priority: number;
  accepted: boolean;
  ownerId: string | null;
  date: Date | null;
  selectedIds: readonly string[];
  narrow: "fixed";
};

it("preserves contextual input typing and the configured field keys through composition", () => {
  const { form, page, row, input } = formBuilder<Draft>();
  const nameRow = row(input("name", {
    validator: value => {
      expectTypeOf(value).toEqualTypeOf<string>();
      return undefined;
    },
  }));
  const priorityRow = row(input("priority", {
    type: "number",
    validator: value => {
      expectTypeOf(value).toEqualTypeOf<number>();
      return undefined;
    },
  }));
  const pages = form(null, page(nameRow), page(3, priorityRow));
  expectTypeOf(pages).toExtend<readonly FormPage<Draft, "name" | "priority">[]>();
  expectTypeOf<(typeof pages)[number]["rows"][number][number]["key"]>().toEqualTypeOf<"name" | "priority">();
  const props: FormProps<Draft, "name" | "priority"> = {
    pages,
    value: { name: "", priority: 0, accepted: false, ownerId: null, date: null, selectedIds: [], narrow: "fixed" },
    onChange: value => { expectTypeOf(value).toEqualTypeOf<Pick<Draft, "name" | "priority">>(); },
  };
  expectTypeOf(props).toExtend<FormProps<Draft, "name" | "priority">>();
});

it("accepts nullable dates and selections and readonly multiple selections", () => {
  const { form, page, row, input } = formBuilder<Draft>();
  const pages = form(page(row(
    input("date", {
      type: "date",
      validator: value => {
        expectTypeOf(value).toEqualTypeOf<Date | null>();
        return undefined;
      },
    }),
    input("ownerId", {
      type: "select",
      items: [],
      validator: value => {
        expectTypeOf(value).toEqualTypeOf<string | null>();
        return undefined;
      },
      renderItem: item => item.id,
    }),
    input("selectedIds", {
      type: "select-multiple",
      items: [],
      renderItem: item => item.id,
      validator: value => {
        expectTypeOf(value).toEqualTypeOf<readonly string[]>();
        return undefined;
      },
    }),
  )));
  expectTypeOf(pages).toExtend<readonly FormPage<Draft>[]>();
});

it("rejects unknown keys, incompatible variants, narrow values, and controlled props", () => {
  const { input } = formBuilder<Draft>();
  function invalidConfigurations() {
    // @ts-expect-error Unknown draft key.
    input("missing", {});
    // @ts-expect-error A boolean field cannot accept text input values.
    input("accepted", { type: "text" });
    // @ts-expect-error A string field cannot accept numeric input values.
    input("name", { type: "number" });
    // @ts-expect-error Text inputs emit more than this literal value.
    input("narrow", {});
    // @ts-expect-error A multiple selection field cannot use a single select.
    input("selectedIds", { type: "select", items: [] });
    // @ts-expect-error Value state belongs to Form.
    input("name", { value: "controlled" });
    // @ts-expect-error Change ownership belongs to Form.
    input("name", { onChange: () => {} });
  }
  expectTypeOf(invalidConfigurations).toBeFunction();
});
