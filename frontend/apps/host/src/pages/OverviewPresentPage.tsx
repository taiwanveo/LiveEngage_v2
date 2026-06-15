/** 即時總覽大螢幕投影（唯讀；控場在總覽／工作台頁）。 */

import * as React from "react";
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POLL_EVENT_TYPES,
  QA_EVENT_TYPES,
  QUIZ_EVENT_TYPES,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PRESENT_PAGE_TITLE_CLASS } from "@liveengage/ui";
import { OverviewDashboard } from "../components/overview/OverviewDashboard";
import { getAccessToken } from "../lib/auth";
import {
  getSessionOverview,
  listSessionParticipants,
  OVERVIEW_POLL_INTERVAL_MS,
} from "../lib/overviewApi";
import { listSessions } from "../lib/sessionApi";

interface Props {
  roomId: string;
}

function overviewQueryKey(sessionId: string, roomId: string): string[] {
  return ["session-overview", sessionId, roomId];
}

function participantsQueryKey(sessionId: string): string[] {
  return ["session-participants", sessionId];
}

export function OverviewPresentPage({ roomId }: Props): React.JSX.Element {
  const qc = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });

  const session = useMemo(
    () => sessionsQuery.data?.find((s) => s.default_room_id === roomId) ?? null,
    [sessionsQuery.data, roomId]
  );

  const overviewQuery = useQuery({
    queryKey: session ? overviewQueryKey(session.id, roomId) : ["session-overview"],
    queryFn: () => getSessionOverview(session!.id, roomId),
    enabled: Boolean(session?.id),
    refetchInterval: OVERVIEW_POLL_INTERVAL_MS,
  });

  const participantsQuery = useQuery({
    queryKey: session ? participantsQueryKey(session.id) : ["session-participants"],
    queryFn: () => listSessionParticipants(session!.id),
    enabled: Boolean(session?.id),
    refetchInterval: OVERVIEW_POLL_INTERVAL_MS,
  });

  const invalidateOverview = useCallback(() => {
    if (!session?.id) return;
    void qc.invalidateQueries({ queryKey: overviewQueryKey(session.id, roomId) });
    void qc.invalidateQueries({ queryKey: participantsQueryKey(session.id) });
  }, [qc, roomId, session?.id]);

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (
        POLL_EVENT_TYPES.has(event.type) ||
        QA_EVENT_TYPES.has(event.type) ||
        QUIZ_EVENT_TYPES.has(event.type)
      ) {
        invalidateOverview();
      }
    },
    [invalidateOverview]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token: getAccessToken(),
    mode: "present",
    onEvent: handleWsEvent,
  });

  const overview = overviewQuery.data;
  const participants = participantsQuery.data?.items ?? [];

  return (
    <div className="relative min-h-full bg-slate-950 text-slate-100">
      <div
        className="absolute right-4 top-4 z-10 flex items-center gap-1.5 opacity-40 transition-opacity hover:opacity-100"
        title={connected ? "WS 已連線" : "WS 未連線"}
      >
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
        />
      </div>

      <header className="border-b border-slate-800 px-8 py-5 md:px-12">
        <h1 className={PRESENT_PAGE_TITLE_CLASS}>即時總覽</h1>
        <p className="mt-2 text-sm text-slate-400">
          {session?.title ?? "活動"} · 參與者 {overview?.participant_count ?? "—"} 位
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
