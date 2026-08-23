const REFRESH_KEY = "refresh_token_random_value";
const ACCESS_KEY = "access_token";
const ACCOUNT_KEY = "account_key";

export async function getRefreshToken(): Promise<string | null> {
  return sessionStorage.getItem(REFRESH_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  sessionStorage.setItem(REFRESH_KEY, token);
}

export async function removeRefreshToken(): Promise<void> {
  sessionStorage.removeItem(REFRESH_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return sessionStorage.getItem(ACCESS_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  sessionStorage.setItem(ACCESS_KEY, token);
}

export async function removeAccessToken(): Promise<void> {
  sessionStorage.removeItem(ACCESS_KEY);
}

export async function getAccountKey(): Promise<string | null> {
  return localStorage.getItem(ACCOUNT_KEY);
}

export async function setAccountKey(accountKey: string): Promise<void> {
  localStorage.setItem(ACCOUNT_KEY, accountKey);
}

export async function removeAccountKey(): Promise<void> {
  localStorage.removeItem(ACCOUNT_KEY);
}
