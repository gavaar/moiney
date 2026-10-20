import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { cn } from "@/lib/styles";
import { DateInput, DecimalInput, TextInput, NumberInput, IconInput, CheckboxInput, SelectInput, TextSelectInput, ToggleInput } from "./components/input-types";
import type { DateInputProps, DecimalInputProps, TextInputProps, NumberInputProps, IconInputProps, CheckboxInputProps, SelectInputProps, SelectMultipleInputProps, TextSelectInputProps, ToggleInputProps } from "./components/input-types";
import { InputLabel } from "./components/InputLabel";
import { InputWrapper, type InputActions } from "./components/InputWrapper";
import { getBorderStyle, getDefaultActions, INPUT_CONTENT_PADDING } from "./input.config";
import { InputHelperText, useInputValidation } from './components/InputHelperText';

type FieldProps<Value> = InputActions & {
  label?: string;
  supportingText?: ReactNode;
  appearance?: "outlined" | "borderless";
  validateOn?: "change" | "blur";
  validator?: (value: Value) => string | undefined;
  onError?: (error?: string) => void;
};

type Field<Props extends { value: unknown }> = Props & FieldProps<Props["value"]>;

export type InputProps =
  | (Field<TextInputProps> & { type?: "text" })
  | (Field<NumberInputProps> & { type: "number" })
  | (Field<DecimalInputProps> & { type: "decimal" })
  | (Field<DateInputProps> & { type: "date" })
  | (Field<IconInputProps> & { type: "icon" })
  | (Field<CheckboxInputProps> & { type: "checkbox" })
  | (Field<ToggleInputProps> & { type: "toggle" })
  | (Field<SelectInputProps> & { type: "select" })
  | (Field<SelectMultipleInputProps> & { type: "select-multiple" })
  | (Field<TextSelectInputProps> & { type: "text-select" });

function validateInput({ value, validator }: InputProps) {
  return (validator as ((value: InputProps["value"]) => string | undefined) | undefined)?.(value);
}

export function Input(props: InputProps) {
  const [focused, setFocused] = useState(false);
  const { error, markAsDirty } = useInputValidation(props, validateInput, props.onError);
  const { disabled, label, prefix, suffix, validateOn = "blur" } = props;
  const accessibilityLabel = props.accessibilityLabel ?? label;
  const appearance = props.appearance ?? (props.type === "checkbox" || props.type === "toggle" ? "borderless" : "outlined");
  const onInteractionEnd = () => { if (!disabled && validateOn === "blur") markAsDirty(); };
  const onValueChange = () => { if (!disabled && validateOn === "change") markAsDirty(); };
  const interaction = { error, onFocusChange: setFocused, onInteractionEnd, accessibilityLabel };
  const trigger = { triggerClassName: INPUT_CONTENT_PADDING };
  const isTrigger = props.type === "date" || props.type === "icon" || props.type === "select" || props.type === "select-multiple" || props.type === "checkbox";

  function change<Value>(onChange?: (value: Value) => void) {
    if (!onChange) return undefined;
    return (value: Value) => {
      if (disabled) return;
      onValueChange();
      onChange(value);
    };
  }

  const defaults = getDefaultActions(props, { onInteractionEnd, onValueChange });

  // Common presentation props never reach native controls through a rest spread.
  const { label: _label, supportingText: _supportingText, appearance: _appearance, validateOn: _validateOn, validator: _validator, onError: _onError,
    prefix: _prefix, suffix: _suffix, ...variant } = props;
  function renderControl() {
    switch (variant.type) {
      case "number":
        return <NumberInput {...variant} {...interaction} onChange={change(variant.onChange)} />;
      case "decimal":
        return <DecimalInput {...variant} {...interaction} onChange={change(variant.onChange)} />;
      case "date":
        return <DateInput {...variant} {...interaction} {...trigger} onChange={change(variant.onChange)} />;
      case "icon":
        return <IconInput {...variant} {...interaction} {...trigger} onChange={change(variant.onChange)} />;
      case "checkbox":
        return <CheckboxInput {...variant} {...interaction} {...trigger} onChange={change(variant.onChange)} />;
      case "toggle":
        return <ToggleInput {...variant} {...interaction} onChange={change(variant.onChange)} />;
      case "select":
        return <SelectInput {...variant} {...interaction} {...trigger} multiple={false} onChange={change(variant.onChange)} />;
      case "select-multiple":
        return <SelectInput {...variant} {...interaction} {...trigger} multiple onChange={change(variant.onChange)} />;
      case "text-select":
        return <TextSelectInput {...variant} {...interaction} onChange={change(variant.onChange)} />;
      default:
        return <TextInput {...variant} {...interaction} onChange={change(variant.onChange)} />;
    }
  }

  return (
    <View className={cn("gap-1", disabled && "opacity-60")}>
      <InputLabel label={label} />

      <InputWrapper
        appearance={appearance}
        borderStyle={getBorderStyle(disabled, focused, error)}
        disabled={disabled}
        contentPadding={!isTrigger}
        prefix={prefix === undefined ? defaults.prefix : prefix}
        suffix={suffix === undefined ? defaults.suffix : suffix}
      >
        {renderControl()}
      </InputWrapper>

      <InputHelperText
        error={error}
        value={props.value}
        supportingText={props.supportingText}
        maxLength={(props as { maxLength?: number }).maxLength}
      />
    </View>
  );
}
