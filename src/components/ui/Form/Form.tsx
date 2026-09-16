import { useMemo, useState, type JSX } from "react";
import { Text, View } from "react-native";
import { Input, type InputProps } from "@ui/Input";
import { FormPager } from "./FormPager";
import type { FormProps, FormValue } from "./form.types";

type FormRow = { key: string; id?: string; content: JSX.Element[] };

export function Form<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string,
>({ header, finalAction, form, value, onChange, activeStep, onStepChange }: FormProps<Values, Keys>) {
  const [errors, setErrors] = useState<Partial<Record<Keys, string>>>({});
  const pages = useMemo(() => {
    const mappedPages: Record<number, { key: number; rows: FormRow[]; hasError: boolean; scrollable: boolean }> = {};

    for (const field of form) {
      const step = field.step ?? 0;
      const page = mappedPages[step] ||= { key: step, rows: [], hasError: false, scrollable: true };
      // Inline selects own their vertical scrolling; don't nest them in a ScrollView.
      if (field.input.type === "select" && field.input.presentation === "inline") page.scrollable = false;
      let row = page.rows.at(-1);
      if (field.row === undefined || !row || row.id !== field.row) {
        row = { key: field.key, id: field.row, content: [] };
        page.rows.push(row);
      }

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
        <View key={field.key} className="gap-1 flex-1">
          <Input {...inputProps} />
          {field.description &&
            <Text className="text-sm text-muted whitespace-normal">
              {field.description}
            </Text>
          }
        </View>
      );

      row.content.push(content);
      page.hasError = errors[field.key] !== undefined || page.hasError;
    }

    return Object.values(mappedPages).sort((a, b) => a.key - b.key).map(({ rows, ...page }) => ({
      ...page,
      content: rows.map(row => (
        <View key={row.key} className="flex-row items-start gap-4">
          {row.content}
        </View>
      )),
    }));
  }, [form, value, onChange, errors]);

  return (
    <View style={{ flexShrink: 1 }} className="gap-4">
      {header}
      <FormPager
        pages={pages}
        finalAction={finalAction}
        activeStep={activeStep}
        onStepChange={onStepChange}
      />
    </View>
  );
}
