/** Admin 總覽 + Analytics 儀表板（Slido 風格）。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AnalyticsMetricCard } from "@liveengage/ui";
import { AdminPageHeader, AdminSectionTitle, adminPageStackClass } from "../components/AdminLayout";
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
      <div className={`mx-auto max-w-6xl animate-slide-up ${adminPageStackClass}`}>
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
          <AdminSectionTitle className="mb-4">參與度分析</AdminSectionTitle>
          <div className="grid gap-4 lg:grid-cols-3">
            <AnalyticsMetricCard
              title="參與互動的參與者"
              summary={
                engagement
                  ? `共 ${engagement.participants_total} 位參與者，其中 ${engagement.participants_engaged} 位曾使用 Poll 或 Q&A。`
                  : "載入中…"
              }
              accent="pink"
              score={engagement ? `${engagement.engaged_score_percent}%` : "—"}
            >
              {engagement ? (
                <ul className="space-y-2 text-xs text-muted">
                  <li className="flex justify-between">
                    <span>Q&A 提問參與者</span>
                    <span>{engagement.participants_qa}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Poll 投票參與者</span>
                    <span>{engagement.participants_poll_voters}</span>
                  </li>
                  <li className="flex justify-between border-t border-border pt-2 font-medium text-foreground">
                    <span>至少用過一種（去重）</span>
                    <span>{engagement.participants_engaged}</span>
                  </li>
                </ul>
              ) : null}
            </AnalyticsMetricCard>

            <AnalyticsMetricCard
              title="Q&A 參與度"
              summary={
                engagement && engagement.qa_questions_total === 0
                  ? "您的 Q&A 尚未收到任何提問。"
                  : engagement
                    ? `已提交 ${engagement.qa_questions_total} 則提問。`
                    : "載入中…"
              }
              accent="yellow"
              {...(engagement?.qa_questions_total === 0
                ? { emptyMessage: "尚無 Q&A 互動" }
                : {})}
            />

            <AnalyticsMetricCard
              title="Poll 參與度"
              summary={
                engagement && engagement.poll_votes_total === 0
                  ? "目前沒有任何 Poll 投票。"
                  : engagement
                    ? `已記錄 ${engagement.poll_votes_total} 則 Poll 回應。`
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
