const REFRESH_KEY = "refresh_token_random_value";
const ACCESS_KEY = "access_token";

export async function getRefreshToken(): Promise<string | null> {
  return localStorage.getItem(REFRESH_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  localStorage.setItem(REFRESH_KEY, token);
}

export async function removeRefreshToken(): Promise<void> {
  localStorage.removeItem(REFRESH_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return localStorage.getItem(ACCESS_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  localStorage.setItem(ACCESS_KEY, token);
}

export async function removeAccessToken(): Promise<void> {
  localStorage.removeItem(ACCESS_KEY);
}
