/** Host token 儲存（localStorage；簡化版，正式環境改 httpOnly cookie）。 */

const ACCESS_KEY = "le.host.access_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_KEY);
}
