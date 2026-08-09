import { Platform } from "react-native";
import { type Id } from "@convex/_generated/dataModel";

export type PickedImage = {
  uri: string;
  mimeType?: string | null;
};

export async function readPickedImageBytes(image: PickedImage): Promise<Blob> {
  if (Platform.OS === "web") {
    const response = await fetch(image.uri);
    return response.blob();
  }
  const { File } = await import("expo-file-system");
  return new File(image.uri) as unknown as Blob;
}

export async function uploadProfilePicture(
  uploadUrl: string,
  image: PickedImage,
): Promise<Id<"_storage">> {
  const body = await readPickedImageBytes(image);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: image.mimeType ? { "Content-Type": image.mimeType } : undefined,
    body,
  });
  if (!response.ok) throw new Error("Upload failed");
  const payload = (await response.json()) as { storageId?: string };
  if (!payload.storageId) throw new Error("Upload failed");
  return payload.storageId as Id<"_storage">;
}
