const REFRESH_KEY = "refresh_token_random_value";

export async function getRefreshToken(): Promise<string | null> {
  return localStorage.getItem(REFRESH_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  localStorage.setItem(REFRESH_KEY, token);
}

export async function removeRefreshToken(): Promise<void> {
  localStorage.removeItem(REFRESH_KEY);
}
