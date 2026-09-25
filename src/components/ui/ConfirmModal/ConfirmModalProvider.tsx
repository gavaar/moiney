import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Text, View } from "react-native";
import { Button } from "@ui/Button";
import { ModalShell } from "@ui/Modal";

export type ConfirmWithModalOptions = {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmWithModal = (options: ConfirmWithModalOptions) => Promise<boolean>;

const ConfirmModalContext = createContext<ConfirmWithModal | null>(null);

export function ConfirmModalProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmWithModalOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setOptions(null);
    resolve?.(confirmed);
  }, []);

  const confirmWithModal = useCallback<ConfirmWithModal>((nextOptions) => {
    if (resolver.current) {
      return Promise.resolve(false);
    }

    setOptions(nextOptions);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  useEffect(() => () => {
    resolver.current?.(false);
    resolver.current = null;
  }, []);

  return (
    <ConfirmModalContext.Provider value={confirmWithModal}>
      {children}
      <ModalShell visible={options !== null} onClose={() => settle(false)}>
        {options ? (
          <View className="gap-4 min-w-[280px]">
            {options.title ? (
              <Text className="text-text font-bold text-lg">{options.title}</Text>
            ) : null}
            {typeof options.message === "string" ? (
              <Text className="text-text text-sm leading-5">{options.message}</Text>
            ) : options.message}
            <View className="flex-row gap-3">
              <Button
                className="flex-1"
                variant="muted"
                title={options.cancelLabel ?? "Cancel"}
                onPress={() => settle(false)}
              />
              <Button
                className="flex-1"
                variant={options.destructive ? "error" : "primary"}
                title={options.confirmLabel ?? "Confirm"}
                onPress={() => settle(true)}
              />
            </View>
          </View>
        ) : null}
      </ModalShell>
    </ConfirmModalContext.Provider>
  );
}

export function useConfirmWithModal(): ConfirmWithModal {
  const confirmWithModal = useContext(ConfirmModalContext);
  if (!confirmWithModal) {
    throw new Error("useConfirmWithModal must be used within ConfirmModalProvider");
  }
  return confirmWithModal;
}
