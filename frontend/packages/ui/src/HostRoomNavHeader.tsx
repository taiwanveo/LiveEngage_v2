/**
 * Host 房間五頁共用頂欄：Logo、頁面標題、房間導覽、主題／登出／投影／分享固定於右上。
 * 用於工作台、即時總覽、Q&A 審核、Poll 管理、Quiz 管理，避免換頁時按鈕位移。
 */

import * as React from "react";
import { APP_HEADER_PADDING, AppHeaderChrome } from "./AppHeader";
import { OrgBrandMark } from "./orgBranding";

export interface HostRoomNavItem {
  href: string;
  label: string;
  active?: boolean;
  /** 文字右下角綠色「進行中」膠囊（不影響標籤排版） */
  liveIndicator?: boolean;
}

export interface HostRoomSessionMeta {
  dateLabel: string;
  code: string;
  visibilityLabel: string;
  /** 活動名稱（顯示於狀態徽章左側，工作台用） */
  activityLabel?: string;
  statusLabel?: string;
  statusBadgeVariant?: "live" | "accent" | "muted";
}

export interface HostRoomNavHeaderProps {
  title: string;
  /** 設定後組織 Logo 可點擊回到活動儀表板 */
  brandHref?: string;
  /** 標題右側（如 WS 狀態點） */
  titleExtra?: React.ReactNode;
  brandAddon?: React.ReactNode;
  /** 副標（例如活動名稱） */
  tagline?: React.ReactNode;
  /** 工作台：日期／代碼／可見性列 */
  sessionMeta?: HostRoomSessionMeta;
  meta?: React.ReactNode;
  navItems: HostRoomNavItem[];
  actions?: React.ReactNode;
  /** 第二列控場按鈕（工作台） */
  navControls?: React.ReactNode;
  onLogout?: () => void;
  /** 頂部設定列附加操作（例如 AI 設定按鈕，與主題／登出並列） */
  headerActions?: React.ReactNode;
  chromeFooterActions?: React.ReactNode;
  subRow?: React.ReactNode;
  maxWidth?: "2xl" | "4xl" | "6xl" | "7xl" | "full";
}

const MAX_W: Record<NonNullable<HostRoomNavHeaderProps["maxWidth"]>, string> = {
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

function TitleText({ title }: { title: string }): React.JSX.Element {
  return <span className="truncate">{title}</span>;
}

function SessionMetaRow({
  meta,
}: {
  meta: HostRoomSessionMeta;
}): React.JSX.Element {
  const {
    dateLabel,
    code,
    visibilityLabel,
    activityLabel,
    statusLabel,
    statusBadgeVariant = "live",
  } = meta;

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span className="inline-flex items-center gap-1">
        <CalendarIcon />
        {dateLabel}
      </span>
      <span className="hidden h-3 w-px bg-border sm:inline-block" />
      <span className="font-mono text-accent">#{code}</span>
      <span className="hidden h-3 w-px bg-border sm:inline-block" />
      <span className="inline-flex items-center gap-1">
        <ShieldIcon />
        {visibilityLabel}
      </span>
      {activityLabel || statusLabel ? (
        <>
          <span className="hidden h-3 w-px bg-border sm:inline-block" />
          <span className="inline-flex min-w-0 max-w-full items-center gap-2">
            {activityLabel ? (
              <span
                className="max-w-[10rem] truncate text-[10px] text-accent sm:max-w-[12rem]"
                title={activityLabel}
              >
                {activityLabel}
              </span>
            ) : null}
            {statusLabel ? (
              <span
                className={`le-badge ${
                  statusBadgeVariant === "live"
                    ? "le-badge-live"
                    : statusBadgeVariant === "accent"
                      ? "bg-accent/15 text-accent"
                      : "bg-muted/20 text-muted"
                }`}
              >
                {statusLabel}
              </span>
            ) : null}
          </span>
        </>
      ) : null}
    </div>
  );
}

function RoomNavLinks({
  navItems,
  actions,
}: {
  navItems: HostRoomNavItem[];
  actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <nav
      className="le-nav-scroll -mx-4 flex shrink-0 items-center gap-0.5 overflow-x-auto px-4 pb-0.5 sm:-mx-6 sm:px-6 lg:mx-0 lg:max-w-full lg:flex-wrap lg:justify-end lg:overflow-visible lg:px-0 lg:pb-0"
      aria-label="房間頁面導覽"
    >
      {navItems.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={`le-nav-link le-nav-link-compact shrink-0 ${
            item.active ? "le-nav-link-active" : ""
          }`}
        >
          <span className="relative inline-block">
            {item.label}
            {item.liveIndicator ? (
              <span
                className="pointer-events-none absolute bottom-0 right-0 translate-x-[20%] translate-y-[85%] whitespace-nowrap rounded-full bg-[rgb(var(--le-success))] px-1 py-px text-[9px] font-semibold leading-tight text-white"
                aria-hidden
              >
                進行中
              </span>
            ) : null}
          </span>
        </a>
      ))}
      {actions}
    </nav>
  );
}

export function HostRoomNavHeader({
  title,
  brandHref,
  titleExtra,
  brandAddon,
  tagline,
  sessionMeta,
  meta,
  navItems,
  actions,
  navControls,
  onLogout,
  headerActions,
  chromeFooterActions,
  subRow,
  maxWidth = "7xl",
}: HostRoomNavHeaderProps): React.JSX.Element {
  const widthClass =
    maxWidth === "full" ? "w-full" : `mx-auto w-full ${MAX_W[maxWidth]}`;

  const chromeFooterDesktop = chromeFooterActions ? (
    <div className="hidden sm:flex">{chromeFooterActions}</div>
  ) : undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/80 backdrop-blur-xl">
      <div className={APP_HEADER_PADDING}>
        <div className={`${widthClass} flex flex-col gap-2 sm:gap-3`}>
          <div className="flex items-start justify-between gap-2">
            <OrgBrandMark
              fallback="LiveEngage"
              className="min-w-0 font-display text-xs font-semibold tracking-wide text-muted"
              {...(brandHref ? { href: brandHref } : {})}
            />
            <AppHeaderChrome
              {...(headerActions ? { headerActions } : {})}
              {...(onLogout ? { onLogout } : {})}
              {...(chromeFooterDesktop ? { footerActions: chromeFooterDesktop } : {})}
            />
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="min-w-0 truncate font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
                  <TitleText title={title} />
                </h1>
                {titleExtra ? <div className="shrink-0">{titleExtra}</div> : null}
                {brandAddon ? <div className="shrink-0">{brandAddon}</div> : null}
              </div>
              {sessionMeta ? <SessionMetaRow meta={sessionMeta} /> : null}
              {tagline ? (
                <div className="mt-0.5 truncate text-xs text-muted">{tagline}</div>
              ) : null}
              {meta ? (
                <div className="mt-0.5 font-mono text-[10px] text-muted">{meta}</div>
              ) : null}
            </div>

            <RoomNavLinks navItems={navItems} {...(actions ? { actions } : {})} />
          </div>

          {chromeFooterActions ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/40 pt-2 sm:hidden">
              {chromeFooterActions}
            </div>
          ) : null}

          {navControls ? (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 border-t border-border/60 pt-2 text-[10px]">
              {navControls}
            </div>
          ) : null}
        </div>
      </div>

      {subRow ? (
        <div className={`border-t border-border/60 ${APP_HEADER_PADDING} pb-2.5 pt-2`}>
          <div className={widthClass}>{subRow}</div>
        </div>
      ) : null}
    </header>
  );
}

function CalendarIcon(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ShieldIcon(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
