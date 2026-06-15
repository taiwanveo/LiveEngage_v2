/** Host token 儲存（localStorage；簡化版，正式環境改 httpOnly cookie）。 */

const ACCESS_KEY = "le.host.access_token";
const REFRESH_KEY = "le.host.refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_KEY, token);
}

export function setAuthTokens(accessToken: string, refreshToken: string): void {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isAccessTokenExpired(token: string, skewSeconds = 30): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number };
    if (typeof payload.exp !== "number") return true;
    return Date.now() / 1000 >= payload.exp - skewSeconds;
  } catch {
    return true;
  }
}

export function hasValidSession(): boolean {
  const access = getAccessToken();
  if (!access) return false;
  if (!isAccessTokenExpired(access)) return true;
  return Boolean(getRefreshToken());
}

/** JWT 內的 role（legacy ``member`` 視同 ``host``）。 */
export function getHostRole(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { role?: string };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function canEditHostContent(): boolean {
  const role = getHostRole();
  if (!role || role === "guest" || role === "cohost") return false;
  return role === "member" || role === "host" || role === "admin" || role === "owner";
}
