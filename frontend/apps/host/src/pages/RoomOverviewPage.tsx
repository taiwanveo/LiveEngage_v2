/** Host 即時總覽：單一活動 KPI + Live Poll + Top Q&A + 參與者名單。 */

import * as React from "react";
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatUserFacingError,
  POLL_EVENT_TYPES,
  QA_EVENT_TYPES,
  QUIZ_EVENT_TYPES,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { JoinShareCard, participantJoinUrl, useSystemNotice } from "@liveengage/ui";
import { getAccessToken } from "../lib/auth";
import {
  getSessionOverview,
  listSessionParticipants,
  OVERVIEW_POLL_INTERVAL_MS,
} from "../lib/overviewApi";
import { listSessions } from "../lib/sessionApi";
import { overviewPresentUrl } from "../lib/presentUrl";
import { HostShell } from "../components/HostShell";
import { OverviewDashboard } from "../components/overview/OverviewDashboard";
import { hostSessionMetaFromSession } from "../lib/hostSessionHeader";

interface Props {
  roomId: string;
  onLogout: () => void;
}

function overviewQueryKey(sessionId: string, roomId: string): string[] {
  return ["session-overview", sessionId, roomId];
}

function participantsQueryKey(sessionId: string): string[] {
  return ["session-participants", sessionId];
}

export function RoomOverviewPage({ roomId, onLogout }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();

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
      if (POLL_EVENT_TYPES.has(event.type) || QA_EVENT_TYPES.has(event.type)) {
        invalidateOverview();
        return;
      }
      if (QUIZ_EVENT_TYPES.has(event.type)) {
        invalidateOverview();
      }
    },
    [invalidateOverview]
  );

  useRoomWebSocket({
    roomId,
    token: getAccessToken(),
    mode: "host",
    onEvent: handleWsEvent,
  });

  React.useEffect(() => {
    if (overviewQuery.error) {
      showError(formatUserFacingError(overviewQuery.error));
    }
  }, [overviewQuery.error, showError]);

  const overview = overviewQuery.data;
  const participants = participantsQuery.data;

  if (!session) {
    return (
      <HostShell
        title="即時總覽"
        subtitle="載入活動中…"
        roomId={roomId}
        onLogout={onLogout}
        activeNav="overview"
      >
        <p className="text-sm text-muted">
          {sessionsQuery.isLoading ? "載入中…" : "找不到此房間對應的活動。"}
        </p>
      </HostShell>
    );
  }

  return (
    <HostShell
      title="即時總覽"
      roomId={roomId}
      onLogout={onLogout}
      activeNav="overview"
      presentHref={overviewPresentUrl(roomId)}
      sessionMeta={hostSessionMetaFromSession(session)}
    >
      <div className="animate-slide-up space-y-6">
        {overview ? (
          <OverviewDashboard
            roomId={roomId}
            overview={overview}
            participants={participants?.items ?? []}
            participantsLoading={participantsQuery.isLoading}
          />
        ) : (
          <p className="text-sm text-muted">載入總覽中…</p>
        )}

        <JoinShareCard code={session.code} joinUrl={participantJoinUrl(session.code)} />
      </div>
      {systemNoticeModal}
    </HostShell>
  );
}
