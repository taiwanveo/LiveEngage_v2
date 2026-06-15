/** 依 roomId 解析 Host 頂欄 session 資訊列（與工作台／即時總覽一致）。 */

import { useQuery } from "@tanstack/react-query";
import type { HostRoomSessionMeta } from "@liveengage/ui";
import { hostSessionMetaFromSession } from "./hostSessionHeader";
import { listSessions } from "./sessionApi";

export function useHostRoomSessionMeta(roomId: string): HostRoomSessionMeta {
  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });

  const session = sessionsQuery.data?.find((s) => s.default_room_id === roomId);

  if (session) {
    return hostSessionMetaFromSession(session);
  }

  if (sessionsQuery.isLoading) {
    return {
      dateLabel: "—",
      code: "—",
      visibilityLabel: "—",
      activityLabel: "載入中…",
    };
  }

  return {
    dateLabel: "—",
    code: "—",
    visibilityLabel: "—",
    activityLabel: "未知活動",
  };
}
