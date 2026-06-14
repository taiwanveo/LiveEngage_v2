/** Session 頂欄：日期、代碼；投影／分享置於登出下方。 */

import * as React from "react";
import { APP_HEADER_PADDING, AppHeaderChrome } from "./AppHeader";

export interface SessionToolbarProps {
  title: string;
  dateLabel: string;
  code: string;
  visibilityLabel: string;
  statusLabel?: string;
  /** 第二列：Stop / Prev / Next 等導覽控項 */
  navControls?: React.ReactNode;
  onBack?: () => void;
  /** 設定後標題可點擊導覽（例如回到活動儀表板） */
  titleHref?: string;
  onLogout?: () => void;
  extra?: React.ReactNode;
  /** 登出列下方（Host 投影／分享） */
  chromeFooterActions?: React.ReactNode;
}

export function SessionToolbar({
  title,
  dateLabel,
  code,
  visibilityLabel,
  statusLabel,
  navControls,
  onBack,
  titleHref,
  onLogout,
  extra,
  chromeFooterActions,
}: SessionToolbarProps): React.JSX.Element {
  const hasNavRow = Boolean(onBack || navControls);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/80 backdrop-blur-xl">
      <div className={`flex items-start gap-3 ${APP_HEADER_PADDING}`}>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-lg font-bold tracking-tight text-foreground">
                {titleHref ? (
                  <a
                    href={titleHref}
                    className="rounded-sm transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    title="回到活動儀表板"
                  >
                    {title}
                  </a>
                ) : (
                  title
                )}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon />
                  {dateLabel}
                </span>
                <span className="hidden h-3 w-px bg-border sm:inline-block" />
                <span className="font-mono">#{code}</span>
                <span className="hidden h-3 w-px bg-border sm:inline-block" />
                <span className="inline-flex items-center gap-1">
                  <ShieldIcon />
                  {visibilityLabel}
                </span>
                {statusLabel ? (
                  <>
                    <span className="hidden h-3 w-px bg-border sm:inline-block" />
                    <span className="le-badge le-badge-live">{statusLabel}</span>
                  </>
                ) : null}
              </div>
            </div>
            {extra ? <div className="shrink-0 pt-1">{extra}</div> : null}
          </div>

          {hasNavRow ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="le-btn-ghost !min-h-[26px] !px-1.5 !text-[10px] text-muted"
                >
                  ← 返回
                </button>
              ) : null}
              {navControls ? (
                <div className="flex flex-wrap items-center gap-1 border-l border-border pl-2">
                  {navControls}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <AppHeaderChrome
          {...(onLogout ? { onLogout } : {})}
          {...(chromeFooterActions ? { footerActions: chromeFooterActions } : {})}
        />
      </div>
    </header>
  );
}

function CalendarIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ShieldIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
