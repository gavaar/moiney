import * as SecureStore from "expo-secure-store";

const REFRESH_KEY = "refresh_token";
const ACCESS_KEY = "access_token";
const ACCOUNT_KEY = "account_key";

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_KEY, token);
}

export async function removeRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, token);
}

export async function removeAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
}

export async function getAccountKey(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCOUNT_KEY);
}

export async function setAccountKey(accountKey: string): Promise<void> {
  await SecureStore.setItemAsync(ACCOUNT_KEY, accountKey);
}

export async function removeAccountKey(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCOUNT_KEY);
}
