import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { Input, type InputProps } from "@ui/Input";
import { FormPager } from "./FormPager";
import type { FormProps, FormValue } from "./form.types";

export function Form<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string,
>({ header, warnings, actions, pages, value, onChange, navigation, fill = false }: FormProps<Values, Keys>) {
  const [errors, setErrors] = useState<Partial<Record<Keys, string>>>({});
  const fields = pages.flatMap(page => page.rows.flat());

  function changeField<K extends Keys>(key: K, nextValue: Values[K]) {
    // Project onto configured fields: hidden disclosures participate, unrelated draft keys do not.
    const next = Object.fromEntries(fields.map(field => [field.key, value[field.key]])) as Pick<Values, Keys>;
    next[key] = nextValue;
    onChange(next);
  }

  const renderedPages = pages.filter(page => page.rows.some(row => row.length > 0)).map(page => {
    const pageFields = page.rows.flat();
    const visibleFields = pageFields.filter(field => !field.reveal || field.reveal.expanded);
    return {
      key: page.key,
      hasError: visibleFields.some(field => errors[field.key] !== undefined),
      scrollable: true,
      content: page.rows.filter(row => row.length > 0).map(row => (
        <View key={row[0].key} className="flex-row items-start gap-4">
          {row.map(field => {
            const reveal = field.reveal;
            const inputProps = {
              ...field.input,
              value: value[field.key],
              onChange: (nextValue: Values[Keys]) => changeField(field.key, nextValue),
              onError: (error?: string) => setErrors(previous => previous[field.key] === error
                ? previous : { ...previous, [field.key]: error }),
            } as InputProps;
            return (
              <View key={field.key} className="gap-1 flex-1">
                {reveal && !reveal.expanded ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={reveal.label}
                    accessibilityState={{ disabled: field.input.disabled, expanded: false }} disabled={field.input.disabled}
                    className="self-start flex-row items-center gap-1 py-1 opacity-50" onPress={reveal.onReveal}>
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
          })}
        </View>
      )),
    };
  });

  return (
    <View style={fill ? { flex: 1 } : { flexShrink: 1 }} className="gap-4">
      {header}
      <FormPager pages={renderedPages} warnings={warnings} actions={actions} navigation={navigation} fill={fill} />
    </View>
  );
}
