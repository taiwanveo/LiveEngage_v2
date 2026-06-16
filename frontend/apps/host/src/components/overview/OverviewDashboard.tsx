/** 即時總覽儀表板內容（Host 頁與投影頁共用）。 */

import * as React from "react";
import { PollRenderer, type PollDetail, type PollInteractionType } from "@liveengage/renderers";
import { AnalyticsMetricCard } from "@liveengage/ui";
import type { SessionOverviewResponse } from "../../lib/overviewApi";
import type { ParticipantHostItem } from "../../lib/overviewApi";
import { pollTypeLabel } from "../../lib/pollTypes";

export interface OverviewDashboardProps {
  roomId: string;
  overview: SessionOverviewResponse;
  participants: ParticipantHostItem[];
  participantsLoading: boolean;
  /** 投影模式：隱藏控場連結、加大版面 */
  present?: boolean;
}

export function OverviewDashboard({
  roomId,
  overview,
  participants,
  participantsLoading,
  present = false,
}: OverviewDashboardProps): React.JSX.Element {
  return (
    <div className={present ? "space-y-8" : "space-y-6"}>
      <KpiRow overview={overview} present={present} />
      <div className={`grid gap-4 ${present ? "lg:grid-cols-2 xl:grid-cols-2" : "lg:grid-cols-2"}`}>
        <LivePollCard overview={overview} roomId={roomId} present={present} />
        <TopQuestionsCard overview={overview} roomId={roomId} present={present} />
        <QuizCard overview={overview} roomId={roomId} present={present} />
        <ParticipantsCard
          participants={participants}
          totalCount={overview.participant_count}
          loading={participantsLoading}
          present={present}
        />
      </div>
    </div>
  );
}

function KpiRow({
  overview,
  present,
}: {
  overview: SessionOverviewResponse;
  present?: boolean;
}): React.JSX.Element {
  const { engagement } = overview;
  return (
    <div className={`grid gap-3 ${present ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
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
  present,
}: {
  overview: SessionOverviewResponse;
  roomId: string;
  present?: boolean;
}): React.JSX.Element {
  const poll = overview.active_poll;
  if (!poll) {
    return (
      <AnalyticsMetricCard
        title="Live Poll"
        summary="目前沒有進行中的 Poll。"
        accent="blue"
        emptyMessage="尚無進行中投票"
        {...(!present ? { learnMoreHref: `#/rooms/${roomId}/workbench` } : {})}
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
          <h3 className={`font-display font-semibold text-foreground ${present ? "text-lg" : "text-sm"}`}>
            Live Poll
          </h3>
          <p className="mt-1 text-xs text-muted">
            {poll.title ?? "未命名"} · {pollTypeLabel(poll.type)} ·{" "}
            {poll.results.response_count} 則回應
          </p>
        </div>
        {!present ? (
          <a
            href={`#/rooms/${roomId}/workbench/${poll.interaction_id}`}
            className="text-xs text-accent hover:underline"
          >
            控場
          </a>
        ) : null}
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
  present,
}: {
  overview: SessionOverviewResponse;
  roomId: string;
  present?: boolean;
}): React.JSX.Element {
  const questions = overview.top_questions;
  if (questions.length === 0) {
    return (
      <AnalyticsMetricCard
        title="熱門問題"
        summary="尚無已公開的 Q&A。"
        accent="yellow"
        emptyMessage="尚無熱門問題"
        {...(!present ? { learnMoreHref: `#/rooms/${roomId}/moderation` } : {})}
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
            <p className={`text-foreground ${present ? "text-base" : "text-sm"}`}>{q.content}</p>
            <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
              <span>👍 {q.upvote_count}</span>
              {q.author_display ? <span>· {q.author_display}</span> : null}
            </p>
          </li>
        ))}
      </ul>
      {!present ? (
        <a
          href={`#/rooms/${roomId}/moderation`}
          className="mt-3 inline-block text-xs text-accent hover:underline"
        >
          前往 Q&amp;A 審核
        </a>
      ) : null}
    </AnalyticsMetricCard>
  );
}

function QuizCard({
  overview,
  roomId,
  present,
}: {
  overview: SessionOverviewResponse;
  roomId: string;
  present?: boolean;
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
        {...(!present ? { learnMoreHref: `#/rooms/${roomId}/sprint9` } : {})}
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
        <ol className={`space-y-2 ${present ? "text-base" : "text-sm"}`}>
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
      {!present ? (
        <a
          href={`#/rooms/${roomId}/sprint9`}
          className="mt-3 inline-block text-xs text-accent hover:underline"
        >
          前往 Quiz 管理
        </a>
      ) : null}
    </AnalyticsMetricCard>
  );
}

function ParticipantsCard({
  participants,
  totalCount,
  loading,
  present,
}: {
  participants: ParticipantHostItem[];
  totalCount: number;
  loading: boolean;
  present?: boolean;
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
        <ul className={`space-y-2 overflow-y-auto text-sm ${present ? "max-h-80" : "max-h-64"}`}>
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
