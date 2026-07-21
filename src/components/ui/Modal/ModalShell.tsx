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
  closeOnBackdropPress?: boolean;
};

export function ModalShell({
  visible,
  onClose,
  children,
  closeOnBackdropPress = true,
}: Props) {
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
          onPress={closeOnBackdropPress ? onClose : undefined}
        />
        <View className="bg-surface rounded-xl p-4 mx-4 min-w-[300px] max-h-[75%] max-w-[min(960px,80vw)]">
          {children}
        </View>
      </View>
    </RNModal>
  );
}
