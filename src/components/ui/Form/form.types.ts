import type { JSX } from "react";
import type { InputProps } from "@ui/Input";

export type FormValue = InputProps["value"];

// A field must both supply a supported value and accept every value its input can emit.
type InputConfiguration<V, P = InputProps> = P extends InputProps
  ? [V] extends [P["value"]]
    ? [Parameters<NonNullable<P["onChange"]>>[0]] extends [V] ? Omit<P, "value" | "onChange"> : never
    : never
  : never;

export type FormField<V extends FormValue, Key extends string = string> = {
  key: Key;
  input: InputConfiguration<V>;
  validator: (value: V) => string | null;
  description?: string;
  step?: number;
};

export type FormProps<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string = keyof Values & string,
> = {
  header?: JSX.Element;
  finalAction?: JSX.Element;
  form: readonly { [K in Keys]: FormField<Values[K], K> }[Keys][];
  value: Values;
  onChange: (value: Pick<Values, NoInfer<Keys>>) => void;
};
