import { useState, type JSX } from "react";
import { Text, View } from "react-native";
import { Input, type InputProps } from "@ui/Input";
import { FormPager } from "./FormPager";
import type { FormProps, FormValue } from "./form.types";

export function Form<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string,
>({ header, form, value, onChange }: FormProps<Values, Keys>) {
  const [validation, setValidation] = useState<ReadonlyMap<string, { source: Values; error: string | null }>>(() => new Map());
  const pages = new Map<number, { key: number; content: JSX.Element[]; hasError: boolean }>();

  for (const field of form) {
    const step = field.step ?? 0;
    let page = pages.get(step);
    if (!page) {
      page = { key: step, content: [], hasError: false };
      pages.set(step, page);
    }

    let error = field.input.error;
    const result = validation.get(field.key);
    if (result) {
      // Retain the edit's error until the parent supplies its next controlled value.
      const validationError = result.source === value ? result.error : field.validator(value[field.key]);
      error = validationError ?? error;
    }
    page.hasError ||= error != null;

    // FormProps ties this key's value and callback to its input variant.
    const inputProps = {
      ...field.input,
      value: value[field.key],
      error,
      onChange: (nextValue: Values[Keys]) => {
        const error = field.validator(nextValue);
        setValidation((previous) => new Map(previous).set(field.key, { source: value, error }));
        onChange(Object.fromEntries(
          form.map(({ key }) => [key, key === field.key ? nextValue : value[key]]),
        ) as Pick<Values, Keys>);
      },
    } as InputProps;

    page.content.push(
      <View key={field.key} className="gap-1">
        <Input {...inputProps} />
        {field.description ? <Text className="text-sm text-muted">{field.description}</Text> : null}
      </View>,
    );
  }

  return (
    <View style={{ flexShrink: 1 }} className="gap-4">
      {header ? <View accessibilityRole="header">{header}</View> : null}
      <FormPager pages={[...pages.values()].sort((a, b) => a.key - b.key)} />
    </View>
  );
}
