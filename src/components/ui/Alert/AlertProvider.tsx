import { createContext, useCallback, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { colors } from "@/lib/styles";

type AlertType = "success" | "error";

type AlertState = {
  message: string;
  type: AlertType;
};

type AlertContextValue = {
  showAlert: { success: (message: string) => void; error: (message: string) => void };
};

export const AlertContext = createContext<AlertContextValue | null>(null);

const BG_COLORS: Record<AlertType, string> = {
  success: colors.success,
  error: colors.error,
};

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const showTimeRef = useRef<number>(0);

  const dismiss = useCallback(() => {
    setAlert(null);
  }, []);

  const show = useCallback(
    (message: string, type: AlertType) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setAlert({ message, type });
      showTimeRef.current = Date.now();
      timerRef.current = setTimeout(dismiss, 5000);
    },
    [dismiss],
  );

  const handlePress = useCallback(() => {
    if (Date.now() - showTimeRef.current >= 500) {
      dismiss();
    }
  }, [dismiss]);

  const showAlert = {
    success: useCallback((message: string) => show(message, "success"), [show]),
    error: useCallback((message: string) => show(message, "error"), [show]),
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}

      {alert && (
        <View className="absolute inset-0 justify-end">
          <View
            className="mx-4 mb-12 px-4 py-5 rounded-xl opacity-90"
            style={{ backgroundColor: BG_COLORS[alert.type] }}
            onTouchEnd={handlePress}
          >
            <Text className="text-white text-sm font-medium text-center">
              {alert.message}
            </Text>
          </View>
        </View>
      )}
    </AlertContext.Provider>
  );
}