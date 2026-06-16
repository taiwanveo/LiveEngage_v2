/** 參與者加入連結（分享 QR／代碼用）。 */

function resolveJoinBase(): string {
  const meta = import.meta as ImportMeta & {
    env?: { VITE_JOIN_BASE?: string; DEV?: boolean };
  };
  const configured = meta.env?.VITE_JOIN_BASE?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "https://le-join.zeabur.app";
  }

  const loc = window.location;
  const path = loc.pathname.replace(/\/$/, "");

  // Join App 自身分享：同源即可
  if (loc.port === "5174" || loc.hostname.includes("le-join")) {
    return `${loc.origin}${path}`;
  }

  // 舊網域仍指向 join（過渡期）
  if (loc.hostname.includes("le-participant")) {
    return "https://le-join.zeabur.app";
  }

  // Host 本地開發：指向 join dev server
  if (meta.env?.DEV && loc.port === "5173") {
    return "http://localhost:5174";
  }

  return "https://le-join.zeabur.app";
}

export function joinUrl(code: string): string {
  const base = resolveJoinBase();
  return `${base}/#/join/${encodeURIComponent(code)}`;
}

/** @deprecated 使用 joinUrl */
export function participantJoinUrl(code: string): string {
  return joinUrl(code);
}
