import { type ReactNode } from "react";
import {
  Modal as RNModal,
  Pressable,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { cn } from "@/lib/styles";
import { useModalFrame } from "./useModalFrame";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  bottomAccessory?: ReactNode;
  width?: "wide" | "content";
};

function ModalContent({ onClose, children, bottomAccessory, width }: Omit<Props, "visible">) {
  const { viewportRef, onViewportLayout, top, height, left, right } = useModalFrame();
  return (
    <View ref={viewportRef} onLayout={onViewportLayout} className="flex-1 bg-black/50">
      <Pressable className="absolute inset-0" testID="modal-backdrop" onPress={onClose} />
      <View
        pointerEvents="box-none"
        testID="modal-content-region"
        style={{
          position: "absolute",
          top,
          height,
          left,
          right,
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <View className={cn("bg-surface rounded-xl p-4",
          width === "content" ? "max-w-[85%]" : "w-[85%] max-w-[960px]",
        )} style={{ flexShrink: 1, maxHeight: "100%" }}>
          {children}
        </View>
        {bottomAccessory ? (
          <View pointerEvents="box-none" style={{ paddingTop: 16, width: "85%", alignItems: "center", flexShrink: 0 }}>
            {bottomAccessory}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function ModalShell({ visible, onClose, children, bottomAccessory, width = "wide" }: Props) {
  return (
    <RNModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <ModalContent onClose={onClose} bottomAccessory={bottomAccessory} width={width}>
          {children}
        </ModalContent>
      </SafeAreaProvider>
    </RNModal>
  );
}
