import { getRefreshToken, setRefreshToken as storeRefreshToken, removeRefreshToken } from "./storage";

type Listener = () => void;

let accessToken: string | null | undefined = undefined;
let refreshToken: string | null | undefined = undefined;

const accessListeners = new Set<Listener>();
const refreshListeners = new Set<Listener>();

export function getAccessSnapshot(): string | null | undefined {
  return accessToken;
}

export function subscribeAccess(onChange: Listener): () => void {
  accessListeners.add(onChange);
  return () => accessListeners.delete(onChange);
}

export function getRefreshSnapshot(): string | null | undefined {
  return refreshToken;
}

export function subscribeRefresh(onChange: Listener): () => void {
  refreshListeners.add(onChange);
  return () => refreshListeners.delete(onChange);
}

export function getRefreshTokenSync(): string | null | undefined {
  return refreshToken;
}

function notifyAll() {
  accessListeners.forEach((l) => l());
  refreshListeners.forEach((l) => l());
}

export async function init() {
  refreshToken = (await getRefreshToken()) ?? null;
  accessToken = undefined;
  notifyAll();
}

export function setAccessToken(token: string) {
  accessToken = token;
  accessListeners.forEach((l) => l());
}

export async function save(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  await storeRefreshToken(refresh);
  notifyAll();
}

export async function clear() {
  accessToken = null;
  refreshToken = null;
  await removeRefreshToken();
  notifyAll();
}