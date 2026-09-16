import { type ReactNode } from "react";
import {
  Modal as RNModal,
  Pressable,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

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
      <SafeAreaProvider>
        <View className="flex-1 bg-black/50">
          <Pressable
            className="absolute inset-0"
            testID="modal-backdrop"
            onPress={onClose}
          />
          <SafeAreaView
            pointerEvents="box-none"
            style={{ flex: 1, alignItems: "center", paddingVertical: 24 }}
          >
            <View className="bg-surface rounded-xl p-4 w-[85%] max-w-[960px] max-h-[85%]" style={{ flexShrink: 1 }}>
              {children}
            </View>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </RNModal>
  );
}
