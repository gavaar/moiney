import { useRef, type ReactNode, type RefObject } from "react";
import {
  Modal as RNModal,
  Platform,
  View,
  type ViewInstance,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { cn } from "@/lib/styles";
import { useModalFrame } from "./useModalFrame";
import { OptionListHost } from "@ui/OptionList";
import { focusFirstControl, hasFocusWithin } from "@ui/keyboard/focus";
import { PointerBackdrop } from "@ui/PointerBackdrop/PointerBackdrop";

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
      <PointerBackdrop className="absolute inset-0" testID="modal-backdrop" onPress={onClose} />
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
  const modalRef = useRef<ViewInstance>(null);
  const boundsRef = useRef<ViewInstance>(null);
  const backHandlerRef = useRef<(() => boolean) | null>(null);
  function requestClose() {
    if (!backHandlerRef.current?.()) onClose();
  }

  // Web mounts RNModal portals automatically so creating them in order is important.
  // Mobile gets animations and stuff from having the RNModal pre-mounted
  if (Platform.OS === "web" && !visible) return null;
  return (
    <RNModal
      ref={modalRef}
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={requestClose}
      onShow={() => { if (!hasFocusWithin(modalRef.current)) focusFirstControl(boundsRef.current); }}
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
