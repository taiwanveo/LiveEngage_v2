/** 生產環境 API / WebSocket 基底（Vite `VITE_API_BASE`）。 */

function normalizeBase(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/\/$/, "");
}

function readViteApiBase(): string | undefined {
  // 須直接讀取，Vite 才能在 build 時靜態替換 env
  return import.meta.env.VITE_API_BASE;
}

/** 後端公開 URL，例如 `https://le-api.zeabur.app`；未設則走同源相對路徑。 */
export function getApiBase(): string {
  return normalizeBase(readViteApiBase());
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

/** 組 WebSocket URL（path 含 query，例如 `/ws?token=...`）。 */
export function wsUrl(pathAndQuery: string): string {
  const base = getApiBase();
  if (!base) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}${pathAndQuery}`;
  }
  const u = new URL(base);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${u.host}${pathAndQuery}`;
}
