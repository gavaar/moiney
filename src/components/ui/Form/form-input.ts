import type { InputProps } from "@ui/Input";
import type { BoundSelectItem, FormValue, InputConfiguration } from "./form.types";

type Uncontrolled<Props> = Props extends unknown ? Omit<Props, "value" | "onChange" | "onError"> : never;

/** Binds matching items and callbacks before heterogeneous fields share storage. */
export function prepareInput<Value extends FormValue, Item extends { id: string }>(
  configuration: InputConfiguration<Value, Item>,
): InputConfiguration<Value, BoundSelectItem>;
export function prepareInput<Item extends { id: string }>(
  configuration: Uncontrolled<InputProps<Item>>,
): Uncontrolled<InputProps<BoundSelectItem>> {
  if (configuration.type !== "select" && configuration.type !== "select-multiple") return configuration;

  const { items, renderItem, itemStyle } = configuration;
  return {
    ...configuration,
    items: items.map(item => ({
      id: item.id,
      content: () => renderItem(item),
      style: itemStyle ? () => itemStyle(item) : undefined,
    })),
    renderItem: (item: BoundSelectItem) => item.content(),
    itemStyle: itemStyle ? (item: BoundSelectItem) => item.style?.() : undefined,
  };
}
