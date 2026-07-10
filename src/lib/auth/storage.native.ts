import * as SecureStore from "expo-secure-store";

const REFRESH_KEY = "refresh_token";

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_KEY, token);
}

export async function removeRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
