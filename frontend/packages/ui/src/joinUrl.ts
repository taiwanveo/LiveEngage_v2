/** 參與者加入連結（分享 QR／代碼用）。 */

import { DEFAULT_PRODUCTION_API_BASE, getApiBase } from "@liveengage/realtime";

function resolveJoinBase(): string {
  const configured = (import.meta.env?.VITE_JOIN_BASE as string | undefined)?.trim();
  // 若設定值非 localhost，才採用設定值（避免手機掃碼掃到 localhost）
  if (configured && !configured.includes("localhost") && !configured.includes("127.0.0.1")) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "https://liveengage-join.pages.dev";
  }

  const loc = window.location;
  const path = loc.pathname.replace(/\/$/, "");

  // 只有在 Join App 自身線上分享時同源
  if (
    (loc.hostname.includes("le-join") || loc.hostname.includes("liveengage-join")) &&
    !loc.hostname.includes("localhost") &&
    !loc.hostname.includes("127.0.0.1")
  ) {
    return `${loc.origin}${path}`;
  }

  // 供外部手機掃描之 QR code 與連結，一律導向全球可存取的公開 Join 頁面
  return "https://liveengage-join.pages.dev";
}

/** 判斷是否為外部裝置可連線之公開 HTTP(S) URL（排除 localhost 與私有 IP）。 */
export function isPublicHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function joinUrl(code: string): string {
  const base = resolveJoinBase();
  const codeParam = encodeURIComponent(code);
  let apiBase = "";
  try {
    apiBase = getApiBase();
  } catch {
    // ignore
  }

  // 參與者端由外部裝置（手機）掃描，API 必須是公開可連線網址。
  // 若目前 host 的 apiBase 是本機 (localhost) 或私有 IP，則一律使用公開 Tunnel (DEFAULT_PRODUCTION_API_BASE)。
  const effectiveApi = isPublicHttpUrl(apiBase)
    ? apiBase
    : DEFAULT_PRODUCTION_API_BASE;

  if (effectiveApi && (effectiveApi.startsWith("http://") || effectiveApi.startsWith("https://"))) {
    return `${base}/?api=${encodeURIComponent(effectiveApi)}#/join/${codeParam}`;
  }

  return `${base}/#/join/${codeParam}`;
}

/** @deprecated 使用 joinUrl */
export function participantJoinUrl(code: string): string {
  return joinUrl(code);
}
