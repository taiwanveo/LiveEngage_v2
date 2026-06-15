/** 參與者加入連結（分享 QR／代碼用）。 */

function resolveParticipantBase(): string {
  const meta = import.meta as ImportMeta & {
    env?: { VITE_PARTICIPANT_BASE?: string; DEV?: boolean };
  };
  const configured = meta.env?.VITE_PARTICIPANT_BASE?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "https://le-participant.zeabur.app";
  }

  const loc = window.location;
  const path = loc.pathname.replace(/\/$/, "");

  // Participant App 自身分享：同源即可
  if (loc.port === "5174" || loc.hostname.includes("le-participant")) {
    return `${loc.origin}${path}`;
  }

  // Host 本地開發：指向 participant dev server
  if (meta.env?.DEV && loc.port === "5173") {
    return "http://localhost:5174";
  }

  return "https://le-participant.zeabur.app";
}

export function participantJoinUrl(code: string): string {
  const base = resolveParticipantBase();
  return `${base}/#/join/${encodeURIComponent(code)}`;
}
