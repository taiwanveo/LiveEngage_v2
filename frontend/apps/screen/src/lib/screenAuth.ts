/** Screen token 與 URL 啟動參數。 */

export interface ScreenBootstrap {
  roomId: string;
  sessionId: string;
  token: string;
  eventCode: string | null;
  theme: string | null;
  bg: string | null;
  fg: string | null;
}

const STORAGE_KEY = "liveengage-screen-auth";

export function parseHashQuery(): URLSearchParams {
  const hash = window.location.hash.replace(/^#/, "");
  const qIndex = hash.indexOf("?");
  const query = qIndex >= 0 ? hash.slice(qIndex + 1) : "";
  return new URLSearchParams(query);
}

export function getScreenToken(): string | null {
  const fromUrl = parseHashQuery().get("token");
  if (fromUrl) {
    sessionStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearScreenToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
