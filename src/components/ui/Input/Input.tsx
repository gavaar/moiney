import type { ComponentProps } from "react";
import { DateInput, DecimalInput, TextInput, NumberInput, IconInput, CheckboxInput, SelectInput, TextSelectInput } from "./components";

export type InputProps =
  | (ComponentProps<typeof TextInput> & { type?: "text" })
  | (ComponentProps<typeof NumberInput> & { type: "number" })
  | (ComponentProps<typeof DecimalInput> & { type: "decimal" })
  | (ComponentProps<typeof DateInput> & { type: "date" })
  | (ComponentProps<typeof IconInput> & { type: "icon" })
  | (ComponentProps<typeof CheckboxInput> & { type: "checkbox" })
  | (ComponentProps<typeof SelectInput> & { type: "select" })
  | (ComponentProps<typeof TextSelectInput> & { type: "text-select" });

export function Input(props: InputProps) {
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
