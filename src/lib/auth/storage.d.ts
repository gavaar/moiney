export function getRefreshToken(): Promise<string | null>;
export function setRefreshToken(token: string): Promise<void>;
export function removeRefreshToken(): Promise<void>;

export function getAccessToken(): Promise<string | null>;
export function setAccessToken(token: string): Promise<void>;
export function removeAccessToken(): Promise<void>;
