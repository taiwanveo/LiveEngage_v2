/** Screen 投影連結（活動代碼或 Room UUID + screen token）。 */

export interface ScreenUrlParams {
  /** 活動代碼（與 room 二擇一） */
  event?: string;
  /** Room UUID（與 event 二擇一） */
  room?: string;
  token: string;
  theme?: string;
  bg?: string;
  fg?: string;
}

function resolveScreenBase(): string {
  const meta = import.meta as ImportMeta & {
    env?: { VITE_SCREEN_BASE?: string; DEV?: boolean };
  };
  const configured = meta.env?.VITE_SCREEN_BASE?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "https://le-screen.zeabur.app";
  }

  const loc = window.location;
  const path = loc.pathname.replace(/\/$/, "");

  if (loc.port === "5175" || loc.hostname.includes("le-screen")) {
    return `${loc.origin}${path}`;
  }

  if (meta.env?.DEV && loc.port === "5173") {
    return "http://localhost:5175";
  }

  return "https://le-screen.zeabur.app";
}

function buildQuery(params: ScreenUrlParams): string {
  const q = new URLSearchParams();
  if (params.event) q.set("event", params.event.toUpperCase());
  if (params.room) q.set("room", params.room);
  q.set("token", params.token);
  if (params.theme) q.set("theme", params.theme);
  if (params.bg) q.set("bg", params.bg);
  if (params.fg) q.set("fg", params.fg);
  return q.toString();
}

/** 組裝 Screen App URL（hash query 模式，與 join 一致）。 */
export function screenUrl(params: ScreenUrlParams): string {
  const base = resolveScreenBase();
  return `${base}/#/?${buildQuery(params)}`;
}

/** 以活動代碼開啟投影。 */
export function screenUrlByEvent(
  code: string,
  token: string,
  extras?: Pick<ScreenUrlParams, "theme" | "bg" | "fg">
): string {
  return screenUrl({ event: code, token, ...extras });
}

/** 以 Room UUID 開啟投影（OBS／整合用）。 */
export function screenUrlByRoom(
  roomId: string,
  token: string,
  extras?: Pick<ScreenUrlParams, "theme" | "bg" | "fg">
): string {
  return screenUrl({ room: roomId, token, ...extras });
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** 驗證並正規化自訂色（hex）。 */
export function sanitizeScreenColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_COLOR.test(trimmed)) return null;
  return trimmed.length === 4
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
    : trimmed;
}
