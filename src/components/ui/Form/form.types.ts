import type { JSX, ReactNode } from "react";
import type { IconName } from "@ui/Icon";
import type { InputProps } from "@ui/Input";

export type FormValue = InputProps["value"];

// A field must both supply a supported value and accept every value its input can emit.
type InputConfiguration<V, P = InputProps> = P extends InputProps
  ? [V] extends [P["value"]]
    ? [Parameters<NonNullable<P["onChange"]>>[0]] extends [V] ? Omit<P, "value" | "onChange" | "onError"> : never
    : never
  : never;

export type FormField<V extends FormValue, Key extends string = string> = {
  key: Key;
  input: InputConfiguration<V>;
  description?: ReactNode;
  reveal?: {
    label: string;
    icon?: IconName;
    expanded: boolean;
    onReveal: () => void;
  };
};

type FieldForValues<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string = keyof Values & string,
> = { [K in Keys]: FormField<Values[K], K> }[Keys];

export type FormRow<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string = keyof Values & string,
> = readonly FieldForValues<Values, Keys>[];

export type FormPage<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string = keyof Values & string,
> = { key: number; rows: readonly FormRow<Values, Keys>[] };

export type FormHeader = {
  title: string;
  icon?: IconName;
  accessibilityLabel?: string;
  badge?: { label: string; icon?: IconName };
};

export type FormProps<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string = keyof Values & string,
> = {
  header?: FormHeader;
  warnings?: readonly string[];
  actions?: JSX.Element;
  /** Initial page key, read on mount. Defaults to the first non-empty page. */
  navigationStart?: number;
  pages: readonly FormPage<Values, Keys>[];
  value: Values;
  onChange: (value: Pick<Values, NoInfer<Keys>>) => void;
};
