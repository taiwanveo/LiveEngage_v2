/** Admin 總覽 + Analytics 儀表板（Slido 風格）。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AnalyticsMetricCard } from "@liveengage/ui";
import { AdminPageHeader, AdminSectionTitle } from "../components/AdminLayout";
import { AdminShell } from "../components/AdminShell";
import {
  getEngagementAnalytics,
  getStatsOverview,
} from "../lib/adminApi";

interface Props {
  onLogout: () => void;
}

export function DashboardPage({ onLogout }: Props): React.JSX.Element {
  const statsQuery = useQuery({ queryKey: ["admin-stats"], queryFn: getStatsOverview });
  const engagementQuery = useQuery({
    queryKey: ["admin-engagement"],
    queryFn: getEngagementAnalytics,
  });

  const stats = statsQuery.data;
  const engagement = engagementQuery.data;

  return (
    <AdminShell active="dashboard" onLogout={onLogout}>
      <div className="mx-auto max-w-6xl animate-slide-up space-y-8">
        <AdminPageHeader
          title="總覽"
          description="組織營運中樞 — 參與度、活動與 AI 用量。"
        />

        {stats ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="活動總數" value={stats.sessions_total} />
            <StatCard label="進行中活動" value={stats.sessions_live} />
            <StatCard label="參與者" value={stats.participants_total} />
            <StatCard label="Poll 回應" value={stats.poll_responses_total} />
            <StatCard label="匯出任務" value={stats.export_jobs_total} />
            <StatCard label="AI 請求" value={stats.ai_requests_total} />
          </div>
        ) : null}

        <section>
          <AdminSectionTitle className="mb-4">Analytics</AdminSectionTitle>
          <div className="grid gap-4 lg:grid-cols-3">
            <AnalyticsMetricCard
              title="Engaged participants"
              summary={
                engagement
                  ? `${engagement.participants_qa + engagement.participants_poll_voters} out of ${engagement.participants_total} participants engaged with polls or Q&A.`
                  : "載入中…"
              }
              accent="pink"
              score={engagement ? `${engagement.engaged_score_percent}%` : "—"}
            >
              {engagement ? (
                <ul className="space-y-2 text-xs text-muted">
                  <li className="flex justify-between">
                    <span>Participants asking in Q&A</span>
                    <span>{engagement.participants_qa}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Participants voting in polls</span>
                    <span>{engagement.participants_poll_voters}</span>
                  </li>
                </ul>
              ) : null}
            </AnalyticsMetricCard>

            <AnalyticsMetricCard
              title="Q&A engagement"
              summary={
                engagement && engagement.qa_questions_total === 0
                  ? "Your Q&A received no questions."
                  : engagement
                    ? `${engagement.qa_questions_total} questions submitted.`
                    : "載入中…"
              }
              accent="yellow"
              {...(engagement?.qa_questions_total === 0
                ? { emptyMessage: "尚無 Q&A 互動" }
                : {})}
            />

            <AnalyticsMetricCard
              title="Poll engagement"
              summary={
                engagement && engagement.poll_votes_total === 0
                  ? "Your session has no poll votes."
                  : engagement
                    ? `${engagement.poll_votes_total} poll responses recorded.`
                    : "載入中…"
              }
              accent="green"
              {...(engagement?.poll_votes_total === 0
                ? { emptyMessage: "尚無 Poll 投票" }
                : {})}
            />
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function StatCard(props: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="le-card p-4">
      <p className="text-sm font-medium text-muted">{props.label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground">{props.value}</p>
    </div>
  );
}
