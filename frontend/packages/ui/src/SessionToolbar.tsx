/** Session 頂欄：日期、代碼、Share、Present；主題／登出與 AppHeader 對齊。 */

import * as React from "react";
import { APP_HEADER_PADDING, AppHeaderChrome } from "./AppHeader";

export interface SessionToolbarProps {
  title: string;
  dateLabel: string;
  code: string;
  visibilityLabel: string;
  statusLabel?: string;
  /** 左上角：Stop / Prev / Next 等導覽控項 */
  navControls?: React.ReactNode;
  onShare?: () => void;
  onPresent?: () => void;
  presentMenu?: React.ReactNode;
  onBack?: () => void;
  onLogout?: () => void;
  extra?: React.ReactNode;
}

export function SessionToolbar({
  title,
  dateLabel,
  code,
  visibilityLabel,
  statusLabel,
  navControls,
  onShare,
  onPresent,
  presentMenu,
  onBack,
  onLogout,
  extra,
}: SessionToolbarProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/80 backdrop-blur-xl">
      <div className={`flex items-center gap-3 ${APP_HEADER_PADDING}`}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          {onBack ? (
            <button type="button" onClick={onBack} className="le-btn-ghost !min-h-[36px] !px-2">
              ← 返回
            </button>
          ) : null}

          {navControls ? (
            <div className="flex flex-wrap items-center gap-1.5 border-r border-border pr-3">
              {navControls}
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-semibold text-foreground">{title}</h1>
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

          <div className="flex flex-wrap items-center gap-2">
            {extra}
            {onShare ? (
              <button
                type="button"
                onClick={onShare}
                className="le-btn-secondary !min-h-[36px] !rounded-full !px-4 !text-sm text-accent"
              >
                <ShareIcon />
                分享（Share）
              </button>
            ) : null}
            {onPresent ? (
              <div className="inline-flex overflow-hidden rounded-full border border-accent">
                <button
                  type="button"
                  onClick={onPresent}
                  className="inline-flex min-h-[36px] items-center gap-2 bg-accent px-4 text-sm font-semibold text-accent-fg hover:brightness-105"
                >
                  <PresentIcon />
                  投影（Present）
                </button>
                {presentMenu ? (
                  <div className="flex items-center border-l border-accent/30 bg-accent px-1">
                    {presentMenu}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <AppHeaderChrome {...(onLogout ? { onLogout } : {})} />
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

function ShareIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51 15.42 17.49M15.41 6.51 8.59 10.49" />
    </svg>
  );
}

function PresentIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
