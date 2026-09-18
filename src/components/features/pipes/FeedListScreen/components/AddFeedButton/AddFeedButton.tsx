import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { colors } from "@/lib/styles";
import { Icon } from "@ui/Icon";
import { Form } from "@ui/Form";
import { ModalShell } from "@ui/Modal";
import { useAddFeedForm } from "./useAddFeedForm";

export function AddFeedButton() {
  const [visible, setVisible] = useState(false);
  const form = useAddFeedForm(() => setVisible(false));

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Add new Feed"
        className="min-h-12 flex-row border-dashed border border-muted/50 rounded-md mr-11"
        activeOpacity={0.5}
      >
        <View className="w-16 items-center justify-center border-r border-dashed border-muted/50">
          <View className="opacity-50">
            <Icon name="pipe" size={16} color={colors.muted} />
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-3 py-2">
          <Text className="text-muted text-base">Add new Feed</Text>
        </View>
      </TouchableOpacity>
      <ModalShell visible={visible} onClose={() => setVisible(false)}>
        {visible ? <Form {...form} /> : null}
      </ModalShell>
    </>
  );
}
