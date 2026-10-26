import { Pressable, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { Input, type InputProps } from "@ui/Input";
import type { BoundSelectItem, FormField, FormRow, FormValue } from "../../form.types";

type Props<Values extends Record<string, FormValue>, Keys extends keyof Values & string> = {
  rows: readonly FormRow<Values, Keys>[];
  value: Values;
  onChange: <K extends Keys>(key: K, value: Values[K]) => void;
  onError: (key: Keys, error?: string) => void;
};

export function FormPageContent<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string,
>({ rows, value, onChange, onError }: Props<Values, Keys>) {
  return rows.filter(row => row.length > 0).map(row => {
    // CSS and Yoga leave space unused when growths total less than one.
    // Scaling by the largest weight preserves ratios and fills fractional rows.
    const growScale = Math.max(...row.map(field => field.grow ?? 1));
    return (
      <View key={row[0].key} className="flex-row items-start gap-1">
        {row.map(field => (
          <FormFieldContent
            key={field.key}
            field={field}
            growScale={growScale}
            value={value}
            onChange={onChange}
            onError={onError}
          />
        ))}
      </View>
    );
  });
}

type FieldProps<Values extends Record<string, FormValue>, Keys extends keyof Values & string> =
  Omit<Props<Values, Keys>, "rows"> & { field: FormRow<Values, Keys>[number]; growScale: number };

function FormFieldContent<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string,
>({ field, growScale, value, onChange, onError }: FieldProps<Values, Keys>) {
  const { reveal, description, input, key } = field;
  const grow = field.grow ?? 1;
  if (!Number.isFinite(grow) || grow <= 0) {
    throw new Error(`Invalid grow for field "${key}": expected a positive finite number`);
  }
  // FormField checks value/emission compatibility; the same key binds both here.
  const inputProps = {
    ...input,
    supportingText: input.supportingText !== undefined
      ? input.supportingText
      : typeof description === "string"
        ? <Text className="text-sm text-muted whitespace-normal">{description}</Text>
        : description,
    value: value[key],
    onChange: (nextValue: Values[Keys]) => onChange(key, nextValue),
    onError: (error?: string) => onError(key, error),
  } as InputProps<BoundSelectItem>;

  return (
    <View style={{ width: 0, flexGrow: grow / growScale, flexBasis: 0, flexShrink: 1, minWidth: 0 }}>
      {reveal && !reveal.expanded
        ? <FormFieldRevealButton reveal={reveal} input={input} />
        : <Input {...inputProps} />
      }
    </View>
  );
}

type RevealButtonProps = {
  reveal: NonNullable<FormField<FormValue>["reveal"]>;
  input: Pick<InputProps, "disabled">;
};

function FormFieldRevealButton({ reveal, input }: RevealButtonProps) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={reveal.label}
    accessibilityState={{ disabled: input.disabled, expanded: false }}
    disabled={input.disabled}
    className="self-start flex-row items-center gap-1 py-1 opacity-40"
    onPress={reveal.onReveal}
  >
    {reveal.icon
      ? <Icon
        name={reveal.icon}
        size={14}
        color={colors.muted}
      />
      : null}
    <Text className="text-xs text-muted">{reveal.label}</Text>
  </Pressable>;
}
