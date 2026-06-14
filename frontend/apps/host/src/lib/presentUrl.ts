/** 投影 URL：從 Host 開啟時用同源路由，共用 JWT（避免 le-present 獨立網域 token 過期）。 */

export function presentAppUrl(roomId: string, pollId: string): string {
  if (typeof window !== "undefined") {
    const path = window.location.pathname.replace(/\/$/, "");
    return `${window.location.origin}${path}#/rooms/${roomId}/polls/${pollId}/present`;
  }
  const meta = import.meta as ImportMeta & { env?: { VITE_HOST_BASE?: string } };
  const base = (meta.env?.VITE_HOST_BASE ?? "https://le-host.zeabur.app").replace(/\/$/, "");
  return `${base}#/rooms/${roomId}/polls/${pollId}/present`;
}
