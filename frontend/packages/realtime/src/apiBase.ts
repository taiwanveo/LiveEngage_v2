/// <reference path="./vite-env.d.ts" />

/** 生產環境 API / WebSocket 基底（Vite `VITE_API_BASE`）。 */

export const DEFAULT_PRODUCTION_API_BASE =
  "https://liveengage.onrender.com";
export const STORAGE_KEY_API_BASE = "liveengage_api_base";

function normalizeBase(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/$/, "");
}

function readViteApiBase(): string | undefined {
  return import.meta.env.VITE_API_BASE;
}

/** 檢查網址參數是否指定了後端 API（例如 ?api=https://... 或 hash 內含 ?api=...） */
function checkUrlForApiBase(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let apiParam: string | null = null;
    if (window.location.search) {
      const searchParams = new URLSearchParams(window.location.search);
      apiParam =
        searchParams.get("api") ||
        searchParams.get("api_base") ||
        searchParams.get("backend");
    }
    if (!apiParam && window.location.hash) {
      const hash = window.location.hash;
      const qIdx = hash.indexOf("?");
      if (qIdx !== -1) {
        const hashParams = new URLSearchParams(hash.slice(qIdx));
        apiParam =
          hashParams.get("api") ||
          hashParams.get("api_base") ||
          hashParams.get("backend");
      }
    }
    if (apiParam) {
      const normalized = normalizeBase(apiParam);
      if (
        normalized.startsWith("http://") ||
        normalized.startsWith("https://")
      ) {
        window.localStorage.setItem(STORAGE_KEY_API_BASE, normalized);
        return normalized;
      }
    }
  } catch {
    // localStorage or URL parsing error
  }
  return null;
}

/** 取得使用者在瀏覽器端自訂的 API 伺服器網址。 */
export function getCustomApiBase(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(STORAGE_KEY_API_BASE);
    if (!val) return null;
    const normalized = normalizeBase(val);
    // 自動清理過期的臨時 Cloudflare Tunnel (trycloudflare.com)
    if (normalized.includes("trycloudflare.com")) {
      window.localStorage.removeItem(STORAGE_KEY_API_BASE);
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

/** 設定或清除自訂 API 伺服器網址。 */
export function setCustomApiBase(url: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (url && url.trim()) {
      window.localStorage.setItem(STORAGE_KEY_API_BASE, normalizeBase(url));
    } else {
      window.localStorage.removeItem(STORAGE_KEY_API_BASE);
    }
  } catch {
    // Ignore
  }
}

/**
 * 後端公開 URL，解析優先權：
 * 1. URL 查詢參數 (?api=https://...)，並自動寫入 localStorage
 * 2. localStorage 自訂伺服器網址
 * 3. 建置時環境變數 VITE_API_BASE
 * 4. 若在 Cloudflare Pages (*.pages.dev) 且上述皆未設定，自動回退至預設公開 Tunnel 避免靜態伺服器報 405
 * 5. 本地開發／同源代理環境預設為空字串（走相對路徑）
 */
export function getApiBase(): string {
  const urlBase = checkUrlForApiBase();
  if (urlBase) return urlBase;

  const customBase = getCustomApiBase();
  if (customBase) return customBase;

  const envBase = normalizeBase(readViteApiBase());
  if (envBase) return envBase;

  if (
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith(".pages.dev") ||
      window.location.hostname.includes("pages.dev"))
  ) {
    return DEFAULT_PRODUCTION_API_BASE;
  }

  return "";
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

/** 組 WebSocket URL（path 含 query，例如 `/ws?token=...`）。 */
export function wsUrl(pathAndQuery: string): string {
  const base = getApiBase();
  if (!base) {
    const proto =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "wss:"
        : "ws:";
    const host =
      typeof window !== "undefined" ? window.location.host : "localhost:8000";
    return `${proto}//${host}${pathAndQuery}`;
  }
  try {
    const u = new URL(base);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}${pathAndQuery}`;
  } catch {
    return pathAndQuery;
  }
}
