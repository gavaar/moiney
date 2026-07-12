export function getRefreshToken(): Promise<string | null>;
export function setRefreshToken(token: string): Promise<void>;
export function removeRefreshToken(): Promise<void>;
