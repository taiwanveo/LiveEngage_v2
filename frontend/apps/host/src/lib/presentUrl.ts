/** 投影 URL：從 Host 開啟時用同源路由，共用 JWT。 */

function hostHashUrl(hashPath: string): string {
  const normalized = hashPath.startsWith("/") ? hashPath : `/${hashPath}`;
  if (typeof window !== "undefined") {
    const path = window.location.pathname.replace(/\/$/, "");
    return `${window.location.origin}${path}#${normalized}`;
  }
  const meta = import.meta as ImportMeta & { env?: { VITE_HOST_BASE?: string } };
  const base = (meta.env?.VITE_HOST_BASE ?? "https://le-host.zeabur.app").replace(/\/$/, "");
  return `${base}#${normalized}`;
}

export function presentAppUrl(roomId: string, pollId: string): string {
  return hostHashUrl(`/rooms/${roomId}/polls/${pollId}/present`);
}

/** Q&A 大螢幕投影（唯讀熱門問題）。 */
export function qaPresentUrl(roomId: string): string {
  return hostHashUrl(`/rooms/${roomId}/moderation/present`);
}

/** Quiz 大螢幕投影（當前子題 + 排行榜）。 */
export function quizPresentUrl(roomId: string, quizId: string): string {
  return hostHashUrl(`/rooms/${roomId}/sprint9/${quizId}/present`);
}
