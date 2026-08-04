import type { ReactNode } from "react";
import type { IconName } from "@ui/Icon";
import type { TextInputProps } from "react-native";
import { DateInput, DecimalInput, TextInput, NumberInput, IconInput, CheckboxInput, SelectInput, TextSelectInput } from "./components";

type CheckboxProps = {
  type: "checkbox";
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

type TextProps = TextInputProps & {
  type?: "text";
  label: string;
  error?: string;
  disabled?: boolean;
  endIcon?: "eye" | "eye-off";
  onEndIconPress?: () => void;
  status?: "checking" | "available" | "unavailable";
  maxLength?: number;
};

type NumberProps = {
  type: "number";
  label: string;
  error?: string;
  disabled?: boolean;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

type DecimalProps = {
  type: "decimal";
  label: string;
  error?: string;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowNegative?: boolean;
};

type DateProps = {
  type: "date";
  label: string;
  error?: string;
  disabled?: boolean;
  value: Date;
  onChange: (date: Date) => void;
};

type IconProps = {
  type: "icon";
  label: string;
  error?: string;
  disabled?: boolean;
  value: IconName | "";
  onSelect: (name: IconName) => void;
};

type SelectProps = {
  type: "select";
  label: string;
  error?: string;
  disabled?: boolean;
  items: readonly { id: string }[];
  renderItem: (item: Record<string, any>) => ReactNode;
  value: string | null;
  onSelect: (id: string) => void;
  placeholder?: string;
};

type TextSelectProps = {
  type: "text-select";
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  onOptionSelect: (value: string) => void;
  options: readonly string[];
  error?: string;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  multiline?: boolean;
};

type Props = TextProps | NumberProps | DecimalProps | DateProps | IconProps | CheckboxProps | SelectProps | TextSelectProps;

export function Input(props: Props) {
  switch (props.type) {
    case "number":
      return <NumberInput {...props} />;
    case "decimal":
      return <DecimalInput {...props} />;
    case "date":
      return <DateInput {...props} />;
    case "icon":
      return <IconInput {...props} />;
    case "checkbox":
      return <CheckboxInput {...props} />;
    case "select":
      return <SelectInput {...props} />;
    case "text-select":
      return <TextSelectInput {...props} />;
    default:
      return <TextInput {...props} />;
  }
}
