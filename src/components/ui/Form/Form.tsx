import { useMemo, useState, type JSX } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { Input, type InputProps } from "@ui/Input";
import { FormPager } from "./FormPager";
import type { FormProps, FormValue } from "./form.types";

type FormRow = { key: string; id?: string; content: JSX.Element[] };

export function Form<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string,
>({ header, finalAction, form, value, onChange, activeStep, onStepChange, fill = false }: FormProps<Values, Keys>) {
  const [errors, setErrors] = useState<Partial<Record<Keys, string>>>({});
  const pages = useMemo(() => {
    const mappedPages: Record<number, { key: number; rows: FormRow[]; hasError: boolean; scrollable: boolean }> = {};

    for (const field of form) {
      const step = field.step ?? 0;
      const page = mappedPages[step] ||= { key: step, rows: [], hasError: false, scrollable: true };
      const reveal = field.reveal;
      const collapsed = reveal !== undefined && !reveal.expanded;
      // Inline selects own their vertical scrolling; don't nest them in a ScrollView.
      if (!collapsed && field.input.type === "select" && field.input.presentation === "inline") page.scrollable = false;
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
          {collapsed && reveal ? (
            <Pressable accessibilityRole="button" accessibilityLabel={reveal.label}
              accessibilityState={{ disabled: field.input.disabled, expanded: false }} disabled={field.input.disabled}
              className="self-start flex-row items-center gap-1 py-1 opacity-50"
              onPress={() => { if (!field.input.disabled) reveal.onReveal(); }}>
              {reveal.icon ? <Icon name={reveal.icon} size={14} color={colors.muted} /> : null}
              <Text className="text-xs text-muted">{reveal.label}</Text>
            </Pressable>
          ) : (
            <>
              <Input {...inputProps} />
              {typeof field.description === "string" ? (
                <Text className="text-sm text-muted whitespace-normal">{field.description}</Text>
              ) : field.description}
            </>
          )}
        </View>
      );

      row.content.push(content);
      page.hasError = (!collapsed && errors[field.key] !== undefined) || page.hasError;
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
    <View style={fill ? { flex: 1 } : { flexShrink: 1 }} className="gap-4">
      {header}
      <FormPager
        pages={pages}
        finalAction={finalAction}
        activeStep={activeStep}
        onStepChange={onStepChange}
        fill={fill}
      />
    </View>
  );
}
