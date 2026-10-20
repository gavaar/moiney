import { useState } from "react";
import { View } from "react-native";
import { FormHeader, FormPageContent, FormPager } from "./components";
import type { FormProps, FormValue } from "./form.types";

export function Form<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string,
>({ header, warnings, actions, pages, value, onChange, navigationStart }: FormProps<Values, Keys>) {
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
      content: <FormPageContent
                  rows={page.rows}
                  value={value}
                  onChange={changeField}
                  onError={(key, error) => setErrors(previous => previous[key] === error
                    ? previous
                    : { ...previous, [key]: error })}
                  />,
    };
  });

  return (
    <View style={{ flexShrink: 1 }} className="gap-4">
      {header ? <FormHeader {...header} /> : null}
      <FormPager
        pages={renderedPages}
        warnings={warnings}
        actions={actions}
        navigationStart={navigationStart}
      />
    </View>
  );
}
