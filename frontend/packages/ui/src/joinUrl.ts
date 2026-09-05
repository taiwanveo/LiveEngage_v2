/** 參與者加入連結（分享 QR／代碼用）。 */

import { getApiBase } from "@liveengage/realtime";

function resolveJoinBase(): string {
  const configured = (import.meta.env?.VITE_JOIN_BASE as string | undefined)?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "http://localhost:5174";
  }

  const loc = window.location;
  const path = loc.pathname.replace(/\/$/, "");

  // Join App 自身分享：同源即可
  if (loc.port === "5174" || loc.hostname.includes("le-join") || loc.hostname.includes("liveengage-join")) {
    return `${loc.origin}${path}`;
  }

  // Cloudflare Pages 自動適配
  if (loc.hostname.endsWith(".pages.dev")) {
    return `${loc.protocol}//liveengage-join.pages.dev`;
  }

  // 舊網域仍指向 join（過渡期）
  if (loc.hostname.includes("le-participant")) {
    return "https://le-join.zeabur.app";
  }

  // 本地開發環境判斷
  const isLocal =
    Boolean(import.meta.env?.DEV) ||
    loc.hostname === "localhost" ||
    loc.hostname === "127.0.0.1" ||
    loc.hostname === "0.0.0.0" ||
    loc.hostname.startsWith("192.168.") ||
    loc.hostname.startsWith("10.") ||
    loc.hostname.startsWith("172.") ||
    loc.port === "5173";

  if (isLocal) {
    return `${loc.protocol}//${loc.hostname}:5174`;
  }

  return "https://le-join.zeabur.app";
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

  if (apiBase && (apiBase.startsWith("http://") || apiBase.startsWith("https://"))) {
    return `${base}/?api=${encodeURIComponent(apiBase)}#/join/${codeParam}`;
  }

  return `${base}/#/join/${codeParam}`;
}

/** @deprecated 使用 joinUrl */
export function participantJoinUrl(code: string): string {
  return joinUrl(code);
}
