import { useState } from "react";
import { FlatList, type FlatListProps } from "react-native";

export type OptionListProps<Item> = Pick<FlatListProps<Item>,
  | "data"
  | "renderItem"
  | "keyExtractor"
  | "extraData"
  | "contentContainerClassName"
  | "columnWrapperClassName"
  | "accessibilityLabel"
  | "accessibilityRole"
  | "numColumns"
  | "ListEmptyComponent"
  | "ListHeaderComponent"
  | "ListFooterComponent"
  | "onContentSizeChange"
  | "onLayout"
>;

/** Hugs short lists and virtualizes scrolling content within the parent's bounds. */
export function OptionList<Item>({ onContentSizeChange, contentContainerClassName, columnWrapperClassName = "gap-2", numColumns = 1, ...props }: OptionListProps<Item>) {
  const [contentHeight, setContentHeight] = useState(0);

  return <FlatList
    {...props}
    numColumns={numColumns}
    contentContainerClassName={contentContainerClassName}
    columnWrapperClassName={numColumns > 1 ? columnWrapperClassName : undefined}
    style={{ flexShrink: 1, height: contentHeight > 0 ? contentHeight : undefined }}
    keyboardShouldPersistTaps="always"
    nestedScrollEnabled
    onContentSizeChange={(width, height) => {
      setContentHeight(height);
      onContentSizeChange?.(width, height);
    }}
  />;
}
