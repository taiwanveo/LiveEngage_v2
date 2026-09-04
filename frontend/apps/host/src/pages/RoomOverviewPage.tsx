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
import { JoinShareCard, joinUrl, useSystemNotice } from "@liveengage/ui";
import { getAccessToken } from "../lib/auth";
import {
  getSessionOverview,
  listSessionParticipants,
  OVERVIEW_POLL_INTERVAL_MS,
} from "../lib/overviewApi";
import { listSessions } from "../lib/sessionApi";
import { overviewPresentUrl } from "../lib/presentUrl";
import { HostShell } from "../components/HostShell";
import { HostRoomHubBreadcrumb } from "../components/HostBreadcrumb";
import { OverviewDashboard } from "../components/overview/OverviewDashboard";
import { AiDecisionReportModal } from "../components/overview/AiDecisionReportModal";

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
  const [reportModalOpen, setReportModalOpen] = React.useState(false);

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
        breadcrumb={<HostRoomHubBreadcrumb roomId={roomId} currentLabel="即時總覽" />}
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
      breadcrumb={<HostRoomHubBreadcrumb roomId={roomId} currentLabel="即時總覽" />}
      actions={
        <button
          type="button"
          onClick={() => setReportModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-3.5 py-2 text-xs font-bold text-white shadow-md transition hover:opacity-95 hover:shadow-lg active:scale-95"
        >
          <span className="text-sm">✨</span>
          一鍵生成 AI 決策報告
        </button>
      }
    >
      <div className="animate-slide-up space-y-6">
        {/* AI Decision Report Hero Callout Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-5 text-white shadow-lg border border-indigo-500/30">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/30 px-3 py-0.5 text-xs font-semibold text-indigo-200 border border-indigo-400/30">
                <span>✨</span> AI 商業高階洞察
              </div>
              <h3 className="text-base font-bold text-white">
                想快速提煉全場意見？一鍵生成會後 AI 決策報告
              </h3>
              <p className="text-xs text-indigo-200 max-w-2xl leading-relaxed">
                自動交叉比對全場投票數據與 Q&A 高熱度提問，精準萃取「關鍵共識」、「議題分歧與拉鋸點」、「未解答焦點」，並產出落地行動方針，支援獨立 HTML 與 Markdown 匯出。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-indigo-900 shadow-md transition hover:bg-indigo-50 active:scale-95"
            >
              <span>📊</span> 開啟決策報告
            </button>
          </div>
          <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl"></div>
        </div>

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

        <JoinShareCard code={session.code} joinUrl={joinUrl(session.code)} />
      </div>

      <AiDecisionReportModal
        sessionId={session.id}
        sessionTitle={session.title}
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />

      {systemNoticeModal}
    </HostShell>
  );
}
