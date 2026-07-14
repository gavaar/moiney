import type { IconName } from "@/components/ui/Icon";
import type { TextInputProps } from "react-native";
import { TextInput } from "./components/TextInput";
import { NumberInput } from "./components/NumberInput";
import { IconInput } from "./components/IconInput";

type TextProps = TextInputProps & {
  type?: "text";
  label: string;
  error?: string;
  endIcon?: "eye" | "eye-off";
  onEndIconPress?: () => void;
  status?: "checking" | "available" | "unavailable";
};

type NumberProps = {
  type: "number";
  label: string;
  error?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

type IconProps = {
  type: "icon";
  label: string;
  error?: string;
  value: IconName | "";
  onSelect: (name: IconName) => void;
};

type Props = TextProps | NumberProps | IconProps;

export function Input(props: Props) {
  switch (props.type) {
    case "number":
      return <NumberInput {...props} />;
    case "icon":
      return <IconInput {...props} />;
    default:
      return <TextInput {...props} />;
  }
}
