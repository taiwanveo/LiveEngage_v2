/** Host 即時總覽：單一活動 KPI + Live Poll + Top Q&A + 參與者名單。 */

import * as React from "react";
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PollRenderer, type PollDetail, type PollInteractionType } from "@liveengage/renderers";
import {
  formatUserFacingError,
  POLL_EVENT_TYPES,
  QA_EVENT_TYPES,
  QUIZ_EVENT_TYPES,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { AnalyticsMetricCard, JoinShareCard, participantJoinUrl, useSystemNotice } from "@liveengage/ui";
import { getAccessToken } from "../lib/auth";
import {
  getSessionOverview,
  listSessionParticipants,
  OVERVIEW_POLL_INTERVAL_MS,
  type SessionOverviewResponse,
} from "../lib/overviewApi";
import { pollTypeLabel } from "../lib/pollTypes";
import { listSessions, type SessionHost } from "../lib/sessionApi";
import { HostShell } from "../components/HostShell";

interface Props {
  roomId: string;
  onLogout: () => void;
}

const STATUS_LABEL: Record<SessionHost["status"], string> = {
  draft: "草稿",
  live: "進行中",
  ended: "已結束",
  archived: "已封存",
};

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

  const { connected } = useRoomWebSocket({
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
      subtitle={session.title}
      roomId={roomId}
      onLogout={onLogout}
      activeNav="overview"
      titleAddon={
        <span
          className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            session.status === "live"
              ? "bg-live/15 text-live"
              : "bg-surface-elevated text-muted"
          }`}
        >
          {STATUS_LABEL[session.status]}
        </span>
      }
      actions={
        <span className="text-xs text-muted" title="WebSocket 連線狀態">
          {connected ? "即時連線中" : "輪詢更新中"}
        </span>
      }
    >
      <div className="space-y-6 animate-slide-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-sm text-accent">{session.code}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`#/rooms/${roomId}/workbench`}
              className="le-btn-secondary !min-h-[36px] !px-3 !text-xs"
            >
              工作台
            </a>
            <a
              href={`#/rooms/${roomId}/moderation`}
              className="le-nav-link !text-xs"
            >
              Q&amp;A 審核
            </a>
          </div>
        </div>

        {overview ? (
          <>
            <KpiRow overview={overview} />
            <div className="grid gap-4 lg:grid-cols-2">
              <LivePollCard overview={overview} roomId={roomId} />
              <TopQuestionsCard overview={overview} roomId={roomId} />
              <QuizCard overview={overview} roomId={roomId} />
              <ParticipantsCard
                participants={participants?.items ?? []}
                totalCount={participants?.total_count ?? overview.participant_count}
                loading={participantsQuery.isLoading}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">載入總覽中…</p>
        )}

        <JoinShareCard code={session.code} joinUrl={participantJoinUrl(session.code)} />
      </div>
      {systemNoticeModal}
    </HostShell>
  );
}

function KpiRow({ overview }: { overview: SessionOverviewResponse }): React.JSX.Element {
  const { engagement } = overview;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <AnalyticsMetricCard
        title="參與者"
        summary={`目前 ${overview.participant_count} 位參與者已加入。`}
        accent="blue"
        score={String(overview.participant_count)}
      />
      <AnalyticsMetricCard
        title="參與率"
        summary={
          engagement.participant_count > 0
            ? `${engagement.participants_engaged} 位曾使用 Poll 或 Q&A。`
            : "尚無參與者。"
        }
        accent="pink"
        score={`${engagement.engaged_percent}%`}
      />
      <AnalyticsMetricCard
        title="Q&A 提問"
        summary={`共 ${engagement.qa_questions_total} 則提問。`}
        accent="yellow"
        score={String(engagement.qa_questions_total)}
      />
      <AnalyticsMetricCard
        title="Poll 回應"
        summary={`共 ${engagement.poll_votes_total} 則投票／作答。`}
        accent="green"
        score={String(engagement.poll_votes_total)}
      />
    </div>
  );
}

function LivePollCard({
  overview,
  roomId,
}: {
  overview: SessionOverviewResponse;
  roomId: string;
}): React.JSX.Element {
  const poll = overview.active_poll;
  if (!poll) {
    return (
      <AnalyticsMetricCard
        title="Live Poll"
        summary="目前沒有進行中的 Poll。"
        accent="blue"
        emptyMessage="尚無進行中投票"
        learnMoreHref={`#/rooms/${roomId}/workbench`}
      />
    );
  }

  const pollDetail: PollDetail = {
    id: poll.interaction_id,
    room_id: poll.room_id,
    type: poll.type as PollInteractionType,
    title: poll.title,
    description: null,
    status: poll.results.status,
    result_visible: true,
    settings_public: {},
    options: poll.options.map((o) => ({
      id: o.id,
      text: o.text,
      order_no: o.order_no,
    })),
    my_submitted: false,
    ends_at: null,
  };

  return (
    <div className="le-card flex h-full flex-col border p-5 le-analytics-accent-blue">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">Live Poll</h3>
          <p className="mt-1 text-xs text-muted">
            {poll.title ?? "未命名"} · {pollTypeLabel(poll.type)} ·{" "}
            {poll.results.response_count} 則回應
          </p>
        </div>
        <a
          href={`#/rooms/${roomId}/workbench/${poll.interaction_id}`}
          className="text-xs text-accent hover:underline"
        >
          控場
        </a>
      </div>
      <div className="flex-1">
        <PollRenderer mode="present" poll={pollDetail} results={poll.results} />
      </div>
    </div>
  );
}

function TopQuestionsCard({
  overview,
  roomId,
}: {
  overview: SessionOverviewResponse;
  roomId: string;
}): React.JSX.Element {
  const questions = overview.top_questions;
  if (questions.length === 0) {
    return (
      <AnalyticsMetricCard
        title="熱門問題"
        summary="尚無已公開的 Q&A。"
        accent="yellow"
        emptyMessage="尚無熱門問題"
        learnMoreHref={`#/rooms/${roomId}/moderation`}
      />
    );
  }

  return (
    <AnalyticsMetricCard
      title="熱門問題"
      summary={`前 ${questions.length} 則已公開問題（依讚數排序）。`}
      accent="yellow"
    >
      <ul className="space-y-3">
        {questions.map((q) => (
          <li key={q.id} className="rounded-md border border-border/60 bg-surface/50 px-3 py-2">
            <p className="text-sm text-foreground">{q.content}</p>
            <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
              <span>👍 {q.upvote_count}</span>
              {q.author_display ? <span>· {q.author_display}</span> : null}
            </p>
          </li>
        ))}
      </ul>
      <a
        href={`#/rooms/${roomId}/moderation`}
        className="mt-3 inline-block text-xs text-accent hover:underline"
      >
        前往 Q&amp;A 審核
      </a>
    </AnalyticsMetricCard>
  );
}

function QuizCard({
  overview,
  roomId,
}: {
  overview: SessionOverviewResponse;
  roomId: string;
}): React.JSX.Element {
  const quiz = overview.quiz_leaderboard_top;
  const survey = overview.survey_summary;

  if (!quiz && !survey) {
    return (
      <AnalyticsMetricCard
        title="Quiz / Survey"
        summary="目前沒有進行中的 Quiz 或 Survey。"
        accent="green"
        emptyMessage="尚無 Quiz 或 Survey"
        learnMoreHref={`#/rooms/${roomId}/sprint9`}
      />
    );
  }

  return (
    <AnalyticsMetricCard
      title="Quiz / Survey"
      summary={
        quiz
          ? `${quiz.title ?? "Quiz"} 排行榜前 ${quiz.entries.length} 名`
          : `${survey?.title ?? "Survey"} 已完成 ${survey?.submission_count ?? 0} 份`
      }
      accent="green"
    >
      {quiz && quiz.entries.length > 0 ? (
        <ol className="space-y-2 text-sm">
          {quiz.entries.map((e) => (
            <li key={e.participant_id} className="flex justify-between gap-2">
              <span>
                <span className="font-mono text-muted">#{e.rank}</span>{" "}
                {e.display_name ?? "參與者"}
              </span>
              <span className="font-semibold text-foreground">{e.total_score} 分</span>
            </li>
          ))}
        </ol>
      ) : survey ? (
        <p className="text-sm text-foreground">
          已完成問卷：<span className="font-semibold">{survey.submission_count}</span> 份
        </p>
      ) : (
        <p className="text-xs text-muted">Quiz 已啟動，尚無作答。</p>
      )}
      <a
        href={`#/rooms/${roomId}/sprint9`}
        className="mt-3 inline-block text-xs text-accent hover:underline"
      >
        前往 Quiz 管理
      </a>
    </AnalyticsMetricCard>
  );
}

function ParticipantsCard({
  participants,
  totalCount,
  loading,
}: {
  participants: { display_name: string | null; joined_at: string | null; is_anonymous: boolean }[];
  totalCount: number;
  loading: boolean;
}): React.JSX.Element {
  return (
    <AnalyticsMetricCard
      title="參與者"
      summary={`共 ${totalCount} 位；顯示最近加入的 ${participants.length} 位。`}
      accent="pink"
      score={String(totalCount)}
    >
      {loading ? (
        <p className="text-xs text-muted">載入中…</p>
      ) : participants.length === 0 ? (
        <p className="text-xs text-muted">尚無參與者加入。</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {participants.map((p, idx) => (
            <li
              key={`${p.display_name ?? "anon"}-${idx}`}
              className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0"
            >
              <span className="truncate text-foreground">
                {p.display_name ?? (p.is_anonymous ? "Anonymous" : "參與者")}
              </span>
              {p.joined_at ? (
                <time className="shrink-0 text-xs text-muted">
                  {new Date(p.joined_at).toLocaleTimeString("zh-TW", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AnalyticsMetricCard>
  );
}
