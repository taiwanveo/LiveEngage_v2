/** Host 頂欄 meta：顯示活動名稱，hover 顯示 room ID。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { listSessions } from "../lib/sessionApi";

interface Props {
  roomId: string;
}

export function HostSessionMeta({ roomId }: Props): React.JSX.Element {
  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });

  const session = sessionsQuery.data?.find((s) => s.default_room_id === roomId);
  const label = session?.title ?? (sessionsQuery.isLoading ? "載入中…" : "未知活動");

  return (
    <span className="cursor-default truncate font-sans text-xs text-muted" title={`room: ${roomId}`}>
      {label}
    </span>
  );
}
