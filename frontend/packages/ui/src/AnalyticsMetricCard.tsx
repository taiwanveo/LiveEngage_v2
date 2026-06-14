/** Analytics 指標卡片（Slido 儀表板風格，支援深色主題）。 */

import * as React from "react";

export interface AnalyticsMetricCardProps {
  title: string;
  summary: string;
  accent?: "pink" | "yellow" | "green" | "blue";
  score?: string;
  children?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  learnMoreHref?: string;
}

const ACCENT: Record<NonNullable<AnalyticsMetricCardProps["accent"]>, string> = {
  pink: "le-analytics-accent-pink",
  yellow: "le-analytics-accent-yellow",
  green: "le-analytics-accent-green",
  blue: "le-analytics-accent-blue",
};

export function AnalyticsMetricCard({
  title,
  summary,
  accent = "blue",
  score,
  children,
  emptyIcon,
  emptyMessage,
  learnMoreHref,
}: AnalyticsMetricCardProps): React.JSX.Element {
  return (
    <div className={`le-card flex h-full flex-col border p-5 ${ACCENT[accent]}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">{summary}</p>
        </div>
        {score ? (
          <span className="rounded-md bg-surface-elevated px-2 py-1 text-xs font-semibold text-foreground shadow-sm">
            {score}
          </span>
        ) : null}
      </div>
      {children ? (
        <div className="flex-1 text-sm text-foreground">{children}</div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          {emptyIcon}
          {emptyMessage ? <p className="mt-3 text-xs text-muted">{emptyMessage}</p> : null}
          {learnMoreHref ? (
            <a
              href={learnMoreHref}
              className="mt-2 text-xs text-accent hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              了解更多
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
