import { type ReactNode } from "react";
import {
  Modal as RNModal,
  Pressable,
  View,
} from "react-native";

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
        <Pressable
          className="absolute inset-0"
          testID="modal-backdrop"
          onPress={onClose}
        />
        <View className="bg-surface rounded-xl p-4 w-[85%] max-w-[960px] max-h-[75%]">
          {children}
        </View>
      </View>
    </RNModal>
  );
}
