import type { IconName } from "@/components/ui/Icon";
import type { TextInputProps } from "react-native";
import { DatetimeInput, DecimalInput, TextInput, NumberInput, IconInput } from "./components";

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

type DatetimeProps = {
  type: "datetime";
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

type Props = TextProps | NumberProps | DecimalProps | DatetimeProps | IconProps;

export function Input(props: Props) {
  switch (props.type) {
    case "number":
      return <NumberInput {...props} />;
    case "decimal":
      return <DecimalInput {...props} />;
    case "datetime":
      return <DatetimeInput {...props} />;
    case "icon":
      return <IconInput {...props} />;
    default:
      return <TextInput {...props} />;
  }
}
