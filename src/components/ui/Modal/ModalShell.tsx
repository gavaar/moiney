import { useRef, type ReactNode, type RefObject } from "react";
import {
  Modal as RNModal,
  Pressable,
  View,
  type ViewInstance,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { cn } from "@/lib/styles";
import { useModalFrame } from "./useModalFrame";
import { OptionListHost } from "@ui/OptionList";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  bottomAccessory?: ReactNode;
  width?: "wide" | "content";
};

type OverlayRefs = { boundsRef: RefObject<ViewInstance | null> };

function ModalContent({ onClose, children, bottomAccessory, width, boundsRef }: Omit<Props, "visible"> & OverlayRefs) {
  const { viewportRef, onViewportLayout, top, height, left, right } = useModalFrame();
  return (
    <View ref={viewportRef} onLayout={onViewportLayout} className="flex-1 bg-black/50">
      <Pressable className="absolute inset-0" testID="modal-backdrop" onPress={onClose} />
      <View
        ref={boundsRef}
        collapsable={false}
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
  const boundsRef = useRef<ViewInstance>(null);
  const backHandlerRef = useRef<(() => boolean) | null>(null);
  function requestClose() {
    if (!backHandlerRef.current?.()) onClose();
  }
  return (
    <RNModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={requestClose}
    >
      <SafeAreaProvider>
        <OptionListHost boundsRef={boundsRef} backHandlerRef={backHandlerRef}>
          <ModalContent onClose={requestClose} bottomAccessory={bottomAccessory} width={width} boundsRef={boundsRef}>
            {children}
          </ModalContent>
        </OptionListHost>
      </SafeAreaProvider>
    </RNModal>
  );
}
