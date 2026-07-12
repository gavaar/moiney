import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";
import { View } from "react-native";

export default function Index() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) return <View className="flex-1 bg-background" />;

  return <Redirect href={isAuthenticated ? "/dashboard" : "/login"} />;
}
