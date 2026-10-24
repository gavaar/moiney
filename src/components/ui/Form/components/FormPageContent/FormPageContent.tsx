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
  return rows.filter(row => row.length > 0).map(row => (
    <View key={row[0].key} className="flex-row items-start gap-4">
      {row.map(field => (
        <FormFieldContent
          key={field.key}
          field={field}
          value={value}
          onChange={onChange}
          onError={onError}
        />
      ))}
    </View>
  ));
}

type FieldProps<Values extends Record<string, FormValue>, Keys extends keyof Values & string> =
  Omit<Props<Values, Keys>, "rows"> & { field: FormRow<Values, Keys>[number] };

function FormFieldContent<
  Values extends Record<string, FormValue>,
  Keys extends keyof Values & string,
>({ field, value, onChange, onError }: FieldProps<Values, Keys>) {
  const { reveal, description, input, key } = field;
  // FormField checks value/emission compatibility; the same key binds both here.
  const inputProps = {
    ...input,
    value: value[key],
    onChange: (nextValue: Values[Keys]) => onChange(key, nextValue),
    onError: (error?: string) => onError(key, error),
  } as InputProps<BoundSelectItem>;

  return (
    <View className="gap-1 flex-1">
      {reveal && !reveal.expanded
        ? <FormFieldRevealButton reveal={reveal} input={input} />
        : (<>
          <Input {...inputProps} />
          {typeof description === "string"
            ? <Text className="text-sm text-muted whitespace-normal">{description}</Text>
            : description}
        </>)
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
