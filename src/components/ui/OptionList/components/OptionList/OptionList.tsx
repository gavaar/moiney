import { useState } from "react";
import { FlatList, type FlatListProps } from "react-native";

export type OptionListProps<Item> = Pick<FlatListProps<Item>,
  | "data"
  | "renderItem"
  | "keyExtractor"
  | "extraData"
  | "accessibilityLabel"
  | "ListEmptyComponent"
  | "onContentSizeChange"
  | "onLayout"
>;

/** Hugs short lists and virtualizes scrolling content within the parent's bounds. */
export function OptionList<Item>({ onContentSizeChange, ...props }: OptionListProps<Item>) {
  const [contentHeight, setContentHeight] = useState(0);

  return <FlatList
    {...props}
    style={{ flexShrink: 1, height: contentHeight > 0 ? contentHeight : undefined }}
    keyboardShouldPersistTaps="always"
    nestedScrollEnabled
    onContentSizeChange={(width, height) => {
      setContentHeight(height);
      onContentSizeChange?.(width, height);
    }}
  />;
}
