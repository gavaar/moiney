export function getRefreshToken(): Promise<string | null>;
export function setRefreshToken(token: string): Promise<void>;
export function removeRefreshToken(): Promise<void>;

export function getAccessToken(): Promise<string | null>;
export function setAccessToken(token: string): Promise<void>;
export function removeAccessToken(): Promise<void>;

export function getAccountKey(): Promise<string | null>;
export function setAccountKey(accountKey: string): Promise<void>;
export function removeAccountKey(): Promise<void>;
