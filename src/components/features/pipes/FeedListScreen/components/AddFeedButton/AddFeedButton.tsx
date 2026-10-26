import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { PipeFormModal } from "@features/pipes/PipeForm/PipeFormModal";

export function AddFeedButton() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Add pipe"
        className="min-h-12 flex-row border-dashed border border-muted/50 rounded-md mr-11"
        activeOpacity={0.5}
      >
        <View className="w-16 items-center justify-center border-r border-dashed border-muted/50">
          <View className="opacity-50">
            <Icon name="pipe" size={16} color={colors.muted} />
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-3 py-2">
          <Text className="text-muted text-base">Add pipe</Text>
        </View>
      </TouchableOpacity>
      {visible ? <PipeFormModal mode="create" typePickerInitiallyExpanded onClose={() => setVisible(false)} /> : null}
    </>
  );
}
