/** 參與者加入連結（分享 QR／代碼用）。 */

export function participantJoinUrl(code: string): string {
  if (typeof window !== "undefined") {
    const base = `${window.location.origin}${window.location.pathname}`.replace(/\/$/, "");
    return `${base}/#/join/${encodeURIComponent(code)}`;
  }
  const meta = import.meta as ImportMeta & {
    env?: { VITE_PARTICIPANT_BASE?: string };
  };
  const base = (
    meta.env?.VITE_PARTICIPANT_BASE ?? "https://le-participant.zeabur.app"
  ).replace(/\/$/, "");
  return `${base}/#/join/${encodeURIComponent(code)}`;
}
