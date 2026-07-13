import {
  Modal as RNModal,
  Pressable,
  View,
  type ReactNode,
} from "react-native";
import { colors } from "@/lib/styles";
import { Icon } from "../Icon";
import { ModalContext, useModalState } from "./ModalContext";

export function ModalProvider({ children }: { children: ReactNode }) {
  const { visible, content, open, close } = useModalState();

  return (
    <ModalContext.Provider value={{ open, close }}>
      {children}
      <RNModal
        transparent
        animationType="fade"
        visible={visible}
        onRequestClose={close}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <Pressable className="absolute inset-0" onPress={close} />
          <View className="bg-surface rounded-xl p-4 mx-4 min-w-[300px]">
            <View className="items-end">
              <Pressable onPress={close} testID="modal-close">
                <Icon name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {content}
          </View>
        </View>
      </RNModal>
    </ModalContext.Provider>
  );
}
