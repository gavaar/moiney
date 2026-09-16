import { useMemo, useState, type JSX } from "react";
import { Text, View } from "react-native";
import { Input, type InputProps } from "@ui/Input";
import { FormPager } from "./FormPager";
import type { FormProps, FormValue } from "./form.types";

export function Form<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string,
>({ header, finalAction, form, value, onChange }: FormProps<Values, Keys>) {
  const [errors, setErrors] = useState<Partial<Record<Keys, string>>>({});
  const pages = useMemo(() => {
    const mappedPages: Record<number, { key: number; content: JSX.Element[]; hasError: boolean }> = {};

    for (const field of form) {
      const step = field.step ?? 0;
      const page = mappedPages[step] ||= { key: step, content: [], hasError: false };

      const inputProps = {
        ...field.input,
        value: value[field.key],
        onChange: (nextValue: Values[Keys]) => {
          const next = Object.fromEntries(form.map(({ key }) => [key, value[key]])) as Pick<Values, Keys>;
          next[field.key] = nextValue;
          onChange(next);
        },
        onError: (error?: string) => setErrors(previous => previous[field.key] === error
          ? previous
          : { ...previous, [field.key]: error }),
      } as InputProps;

      const content = (
        <View key={field.key} className="gap-1">
          <Input {...inputProps} />
          {field.description &&
            <Text className="text-sm text-muted">
              {field.description}
            </Text>
          }
        </View>
      );

      page.content.push(content);
      page.hasError = errors[field.key] !== undefined || page.hasError;
    }

    return Object.values(mappedPages).sort((a, b) => a.key - b.key);
  }, [form, value, onChange, errors]);

  return (
    <View style={{ flexShrink: 1 }} className="gap-4">
      {header}
      <FormPager
        pages={pages}
        finalAction={finalAction}
      />
    </View>
  );
}
