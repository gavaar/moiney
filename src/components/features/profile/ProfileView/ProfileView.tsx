import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAlert } from "@ui/Alert";
import { ModalShell } from "@ui/Modal";
import { Button } from "@ui/Button";
import * as ImagePicker from "expo-image-picker";
import { uploadProfilePicture } from "./uploadProfilePicture";
import { APP_ICON } from "./appIcon";

export function ProfileView() {
  const profile = useQuery(api.profile.getMyProfile);
  const generateUploadUrl = useMutation(api.profile.generateProfilePictureUploadUrl);
  const setPicture = useMutation(api.profile.setProfilePicture);
  const removePicture = useMutation(api.profile.removeProfilePicture);
  const showAlert = useAlert();

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleChoosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadProfilePicture(uploadUrl, {
        uri: asset.uri,
        mimeType: asset.mimeType,
      });
      await setPicture({ storageId });
      showAlert.success("Profile picture updated");
    } catch (error) {
      showAlert.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    setBusy(true);
    try {
      await removePicture();
      showAlert.success("Profile picture removed");
    } catch (error) {
      showAlert.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="items-center gap-4">
      <Pressable
        testID="profile-avatar"
        onPress={() => setEditing(true)}
        className="w-24 h-24 rounded-full overflow-hidden border-2 border-border items-center justify-center"
        accessibilityLabel="Edit profile picture"
      >
        <Image
          testID="profile-avatar-image"
          source={profile?.pictureUrl ? { uri: profile.pictureUrl } : APP_ICON}
          className="w-full h-full"
        />
      </Pressable>

      <Text className="text-2xl font-bold text-text">
        {profile ? `@${profile.username}` : "@"}
      </Text>

      <ModalShell visible={editing} onClose={() => setEditing(false)}>
        <View className="items-center gap-3">
          <View
            className="w-full overflow-hidden rounded-full border-2 border-border"
            style={{ aspectRatio: 1 }}
          >
            <Image
              testID="profile-picture-preview"
              source={profile?.pictureUrl ? { uri: profile.pictureUrl } : APP_ICON}
              style={{ width: "100%", height: "100%" }}
              accessibilityLabel="Profile picture preview"
            />
          </View>
          <View className="w-full flex-row gap-3">
            {profile?.pictureUrl ? (
              <Button
                title="Remove photo"
                variant="error"
                onPress={handleRemovePhoto}
                loading={busy}
                disabled={busy}
                testID="remove-photo-button"
              />
            ) : null}
            <Button
              title="Update image"
              onPress={handleChoosePhoto}
              loading={busy}
              disabled={busy}
              testID="choose-photo-button"
              className="ml-auto"
            />
          </View>
        </View>
      </ModalShell>
    </View>
  );
}
