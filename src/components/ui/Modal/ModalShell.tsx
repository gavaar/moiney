import { type ReactNode } from "react";
import {
  Modal as RNModal,
  Pressable,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/styles";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  bottomAccessory?: ReactNode;
  width?: "wide" | "content";
};

export function ModalShell({ visible, onClose, children, bottomAccessory, width = "wide" }: Props) {
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
            <View className={cn("bg-surface rounded-xl p-4 max-h-[85%]",
              width === "content" ? "max-w-[85%]" : "w-[85%] max-w-[960px]",
            )} style={{ flexShrink: 1 }}>
              {children}
            </View>
            {bottomAccessory ? (
              <View pointerEvents="box-none" style={{ marginTop: "auto", marginBottom: 48, paddingTop: 16, width: "85%", alignItems: "center", flexShrink: 0 }}>
                {bottomAccessory}
              </View>
            ) : null}
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </RNModal>
  );
}
