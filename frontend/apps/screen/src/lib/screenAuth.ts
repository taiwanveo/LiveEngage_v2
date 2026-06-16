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

export interface ScreenTokenPayload {
  room_id: string;
  session_id: string;
  token_epoch?: number;
}

const STORAGE_KEY = "liveengage-screen-auth";

export function parseHashQuery(): URLSearchParams {
  const hash = window.location.hash.replace(/^#/, "");
  const qIndex = hash.indexOf("?");
  const query = qIndex >= 0 ? hash.slice(qIndex + 1) : "";
  return new URLSearchParams(query);
}

/** 從 screen JWT payload 讀取 room_id／session_id（僅供啟動導向，權限仍由 API 驗證）。 */
export function parseScreenTokenPayload(token: string): ScreenTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const segment = parts[1];
    if (!segment) return null;
    const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const json = atob(padded + "=".repeat(padLen));
    const payload = JSON.parse(json) as {
      typ?: string;
      room_id?: string;
      session_id?: string;
      token_epoch?: number;
    };
    if (payload.typ !== "screen") return null;
    if (!payload.room_id || !payload.session_id) return null;
    return {
      room_id: payload.room_id,
      session_id: payload.session_id,
      ...(payload.token_epoch != null ? { token_epoch: payload.token_epoch } : {}),
    };
  } catch {
    return null;
  }
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
