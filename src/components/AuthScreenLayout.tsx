import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useKeyboardHeight } from "@/lib/useKeyboardHeight";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthScreenLayout({ title, subtitle, children, footer }: Props) {
  const keyboardHeight = useKeyboardHeight();

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingBottom: keyboardHeight,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-text">{title}</Text>
            <Text className="text-base text-secondary">{subtitle}</Text>
          </View>

          <View className="gap-4">{children}</View>

          {footer}
        </View>
      </ScrollView>
    </View>
  );
}