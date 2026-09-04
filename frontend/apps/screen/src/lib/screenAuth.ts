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
  const result = new URLSearchParams();

  // 1. 從標準 Search 讀取 (?token=...&room=...)
  if (typeof window !== "undefined" && window.location.search) {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.forEach((val, key) => result.set(key, val));
    } catch {
      // ignore
    }
  }

  // 2. 從 Hash 讀取 (/#/?token=... 或 /#?token=... 或 /#token=... 或 #token=...)
  if (typeof window !== "undefined" && window.location.hash) {
    try {
      const rawHash = window.location.hash.replace(/^#\/?/, "");
      const qIndex = rawHash.indexOf("?");
      const query = qIndex >= 0 ? rawHash.slice(qIndex + 1) : rawHash;
      const hashParams = new URLSearchParams(query);
      hashParams.forEach((val, key) => result.set(key, val));
    } catch {
      // ignore
    }
  }

  // 3. Fallback: 檢測整串 href（防止奇怪的路由重寫或通訊軟體編碼）
  if (typeof window !== "undefined") {
    const href = window.location.href;
    if (!result.get("token")) {
      const match = href.match(/[?&#]token=([^&#]+)/);
      if (match && match[1]) {
        try {
          result.set("token", decodeURIComponent(match[1]));
        } catch {
          result.set("token", match[1]);
        }
      }
    }
    if (!result.get("room")) {
      const match = href.match(/[?&#]room=([^&#]+)/);
      if (match && match[1]) {
        try {
          result.set("room", decodeURIComponent(match[1]));
        } catch {
          result.set("room", match[1]);
        }
      }
    }
    if (!result.get("event")) {
      const match = href.match(/[?&#]event=([^&#]+)/);
      if (match && match[1]) {
        try {
          result.set("event", decodeURIComponent(match[1]));
        } catch {
          result.set("event", match[1]);
        }
      }
    }
    if (!result.get("theme")) {
      const match = href.match(/[?&#]theme=([^&#]+)/);
      if (match && match[1]) {
        try {
          result.set("theme", decodeURIComponent(match[1]));
        } catch {
          result.set("theme", match[1]);
        }
      }
    }
  }

  return result;
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

export function setScreenToken(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // 避免無痕模式阻擋
  }
}

export function getScreenToken(): string | null {
  const fromUrl = parseHashQuery().get("token");
  if (fromUrl) {
    setScreenToken(fromUrl);
    return fromUrl;
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearScreenToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
