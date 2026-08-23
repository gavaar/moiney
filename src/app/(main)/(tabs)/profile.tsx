import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppScreenHeader } from "@features/app/AppScreenHeader";
import { SignOutButton } from "@features/account/SignOutButton";
import { ProfileView } from "@features/profile/ProfileView/ProfileView";

export default function Profile() {
  const router = useRouter();

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <AppScreenHeader title="Profile" />

      <ScrollView className="flex-1" contentContainerClassName="items-center flex-1 pt-8 gap-8">
        <ProfileView />
        <SignOutButton onSignedOut={() => router.replace("/login")} />
      </ScrollView>
    </SafeAreaView>
  );
}
