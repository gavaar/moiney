import type { IconName } from "@/components/ui/Icon";
import type { TextInputProps } from "react-native";
import { DecimalInput, TextInput, NumberInput, IconInput } from "./components";

type TextProps = TextInputProps & {
  type?: "text";
  label: string;
  error?: string;
  disabled?: boolean;
  endIcon?: "eye" | "eye-off";
  onEndIconPress?: () => void;
  status?: "checking" | "available" | "unavailable";
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
};

type IconProps = {
  type: "icon";
  label: string;
  error?: string;
  disabled?: boolean;
  value: IconName | "";
  onSelect: (name: IconName) => void;
};

type Props = TextProps | NumberProps | DecimalProps | IconProps;

export function Input(props: Props) {
  switch (props.type) {
    case "number":
      return <NumberInput {...props} />;
    case "decimal":
      return <DecimalInput {...props} />;
    case "icon":
      return <IconInput {...props} />;
    default:
      return <TextInput {...props} />;
  }
}
