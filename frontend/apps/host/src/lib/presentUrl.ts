/** 投影 URL：Host 同源 hash 路由（過渡保留）；新投影請用 `@liveengage/ui` 的 `screenUrl*`。 */

function hostHashUrl(hashPath: string): string {
  const normalized = hashPath.startsWith("/") ? hashPath : `/${hashPath}`;
  if (typeof window !== "undefined") {
    const path = window.location.pathname.replace(/\/$/, "");
    return `${window.location.origin}${path}#${normalized}`;
  }
  const base = (
    (import.meta.env?.VITE_HOST_BASE as string | undefined) ?? "http://localhost:5173"
  ).replace(/\/$/, "");
  return `${base}#${normalized}`;
}

export function presentAppUrl(roomId: string, pollId: string): string {
  return hostHashUrl(`/rooms/${roomId}/polls/${pollId}/present`);
}

/** Q&A 大螢幕投影（唯讀熱門問題）。 */
export function qaPresentUrl(roomId: string): string {
  return hostHashUrl(`/rooms/${roomId}/moderation/present`);
}

/** 即時總覽大螢幕投影。 */
export function overviewPresentUrl(roomId: string): string {
  return hostHashUrl(`/rooms/${roomId}/overview/present`);
}

/** Quiz 大螢幕投影（當前子題 + 排行榜）。 */
export function quizPresentUrl(roomId: string, quizId: string): string {
  return sprint9PresentUrl(roomId, quizId);
}

/** Ideas 大螢幕投影（熱門點子牆）。 */
export function ideasPresentUrl(roomId: string, boardId: string): string {
  return sprint9PresentUrl(roomId, boardId);
}

/** Survey 大螢幕投影（問卷結果聚合）。 */
export function surveyPresentUrl(roomId: string, surveyId: string): string {
  return sprint9PresentUrl(roomId, surveyId);
}

/** Sprint 9 互動投影（Quiz / Ideas / Survey 共用路由，依 type 切換畫面）。 */
export function sprint9PresentUrl(roomId: string, interactionId: string): string {
  return hostHashUrl(`/rooms/${roomId}/sprint9/${interactionId}/present`);
}
