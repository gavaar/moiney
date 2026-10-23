import type { FormField, FormRow, FormValue } from "./form.types";

type Optional<T> = T | false | null | undefined;
type Field<Values extends Record<string, FormValue>, Keys extends keyof Values & string> =
  FormRow<Values>[number] & { key: Keys };
type Row<Values extends Record<string, FormValue>, Keys extends keyof Values & string> = readonly Field<Values, Keys>[];
type Page<Values extends Record<string, FormValue>, Keys extends keyof Values & string> = {
  key?: number;
  rows: readonly Row<Values, Keys>[];
};

function present<T>(value: Optional<T>): value is T {
  return value !== false && value !== null && value !== undefined;
}

/** Composes ordinary Form configuration without mutable page or row state. */
export function formBuilder<Values extends Record<string, FormValue>>(
  options: { defaults?: { disabled?: boolean } } = {},
) {
  type Key = keyof Values & string;

  function input<K extends Key>(
    key: K,
    configuration: FormField<Values[K], K>["input"],
    metadata: Pick<FormField<Values[K], K>, "description" | "reveal"> = {},
  ): FormField<Values[K], K> {
    return { key, input: { ...options.defaults, ...configuration }, ...metadata };
  }

  function row<K extends Key>(...fields: Optional<Field<Values, K>>[]): Row<Values, K> {
    return fields.filter(present);
  }

  function page<K extends Key>(...rows: Optional<Row<Values, K>>[]): Page<Values, K>;
  function page<K extends Key>(key: number, ...rows: Optional<Row<Values, K>>[]): Page<Values, K>;
  function page<K extends Key>(
    first?: number | Optional<Row<Values, K>>,
    ...rest: Optional<Row<Values, K>>[]
  ): Page<Values, K> {
    return typeof first === "number"
      ? { key: first, rows: rest.filter(present) }
      : { rows: [first, ...rest].filter(present) };
  }

  function form<K extends Key>(...pages: Optional<Page<Values, K>>[]): readonly { key: number; rows: readonly Row<Values, K>[] }[] {
    let nextKey = 0;
    const pageKeys = new Set<number>();
    const fieldKeys = new Set<string>();
    return pages.filter(present).map(definition => {
      const key = definition.key ?? nextKey;
      nextKey = key + 1;
      if (pageKeys.has(key)) throw new Error(`Duplicate page key: ${key}`);
      pageKeys.add(key);
      if (definition.rows.length === 0) throw new Error(`Empty page: ${key}`);
      for (const fields of definition.rows) {
        if (fields.length === 0) throw new Error(`Empty row in page: ${key}`);
        for (const field of fields) {
          if (fieldKeys.has(field.key)) throw new Error(`Duplicate field key: ${field.key}`);
          fieldKeys.add(field.key);
        }
      }
      return { key, rows: definition.rows };
    });
  }

  return { form, page, row, input };
}
