import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Text, View } from "react-native";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <View className="flex-1 bg-background">
      <Text>Loading...</Text>
    </View>;
  }
  return <Redirect href={isAuthenticated ? "/pipes" : "/login"} />;
}
