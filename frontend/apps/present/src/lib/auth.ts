/** Present token 儲存（localStorage；與 Host 共用 access token 格式）。 */

const ACCESS_KEY = "le.present.access_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_KEY);
}
