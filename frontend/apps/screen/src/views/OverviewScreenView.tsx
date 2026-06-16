/** Overview 投影視圖。 */

import * as React from "react";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POLL_EVENT_TYPES,
  QA_EVENT_TYPES,
  QUIZ_EVENT_TYPES,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PRESENT_PAGE_TITLE_CLASS } from "@liveengage/ui";
import { OverviewDashboard } from "../components/OverviewDashboard";
import { getScreenToken } from "../lib/screenAuth";
import {
  getSessionOverview,
  listSessionParticipants,
  OVERVIEW_POLL_INTERVAL_MS,
} from "../lib/overviewApi";

interface Props {
  roomId: string;
  sessionId: string;
  sessionTitle: string | null;
}

export function OverviewScreenView({
  roomId,
  sessionId,
  sessionTitle,
}: Props): React.JSX.Element {
  const qc = useQueryClient();
  const token = getScreenToken();

  const overviewQuery = useQuery({
    queryKey: ["session-overview", sessionId, roomId],
    queryFn: () => getSessionOverview(sessionId, roomId),
    refetchInterval: OVERVIEW_POLL_INTERVAL_MS,
  });

  const participantsQuery = useQuery({
    queryKey: ["session-participants", sessionId],
    queryFn: () => listSessionParticipants(sessionId),
    refetchInterval: OVERVIEW_POLL_INTERVAL_MS,
  });

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["session-overview", sessionId, roomId] });
    void qc.invalidateQueries({ queryKey: ["session-participants", sessionId] });
  }, [qc, roomId, sessionId]);

  const handleWs = useCallback(
    (event: WsEvent) => {
      if (
        POLL_EVENT_TYPES.has(event.type) ||
        QA_EVENT_TYPES.has(event.type) ||
        QUIZ_EVENT_TYPES.has(event.type)
      ) {
        invalidate();
      }
    },
    [invalidate]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token,
    mode: "screen",
    onEvent: handleWs,
  });

  const overview = overviewQuery.data;
  const participants = participantsQuery.data?.items ?? [];

  return (
    <div className="relative min-h-dvh bg-slate-950 text-slate-100">
      <div className="absolute right-4 top-4 z-10 opacity-90" title={connected ? "WS 已連線" : "WS 未連線"}>
        <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
      </div>
      <header className="border-b border-slate-800 px-8 py-5 md:px-12">
        <h1 className={PRESENT_PAGE_TITLE_CLASS}>即時總覽</h1>
        <p className="mt-2 text-sm text-slate-400">
          {sessionTitle ?? overview?.title ?? "活動"} · 參與者 {overview?.participant_count ?? "—"} 位
        </p>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8 md:px-12">
        {overview ? (
          <OverviewDashboard
            roomId={roomId}
            overview={overview}
            participants={participants}
            participantsLoading={participantsQuery.isLoading}
            present
          />
        ) : (
          <p className="text-center text-slate-400">載入總覽中…</p>
        )}
      </main>
    </div>
  );
}
