import { type ReactNode } from "react";
import {
  Modal as RNModal,
  Pressable,
  View,
} from "react-native";
import { colors } from "@/lib/styles";
import { Icon } from "@/components/ui/Icon";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function ModalShell({ visible, onClose, children }: Props) {
  return (
    <RNModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="bg-surface rounded-xl p-4 mx-4 min-w-[300px]">
          <View className="items-end">
            <Pressable onPress={onClose} testID="modal-close">
              <Icon name="close" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </RNModal>
  );
}
