/** 應用頂部導覽列（Host / Participant / Admin / Present 共用）。 */

import * as React from "react";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { OrgBrandMark, useOrgBranding } from "./orgBranding";

interface NavItem {
  href: string;
  label: string;
  active?: boolean;
}

interface Props {
  brand: string;
  /** 設定後 brand 可點擊導覽（例如 Host 回到活動儀表板） */
  brandHref?: string;
  tagline?: string;
  meta?: React.ReactNode;
  /** 標題右側附加控制（如「重新整理」） */
  brandAddon?: React.ReactNode;
  /** 副標右側附加控制（如「建立新活動」） */
  taglineAddon?: React.ReactNode;
  navItems?: NavItem[];
  actions?: React.ReactNode;
  onLogout?: () => void;
  /** 登出列下方（例如 Host 投影／分享） */
  chromeFooterActions?: React.ReactNode;
  /** 標題列下方固定列（例如 Host 麵包屑） */
  subRow?: React.ReactNode;
  /** 登出按鈕文字（Participant 可用「離開」） */
  logoutLabel?: string;
  maxWidth?: "2xl" | "4xl" | "6xl" | "7xl" | "full";
}

const MAX_W: Record<NonNullable<Props["maxWidth"]>, string> = {
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

/** 四端一致的 header 內距 — 主題／登出按鈕對齊 viewport 右上角 */
export const APP_HEADER_PADDING = "px-4 py-3 sm:px-6";

/** 主題切換 + 登出（固定於 viewport 右上角） */
export function AppHeaderChrome({
  onLogout,
  logoutLabel = "登出",
  footerActions,
}: {
  onLogout?: () => void;
  logoutLabel?: string;
  footerActions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5" aria-label="顯示設定與帳號">
      <div className="flex items-center gap-2">
        <ThemeSwitcher compact />
        {onLogout ? (
          <button type="button" onClick={onLogout} className="le-btn-ghost !min-h-[40px]">
            {logoutLabel}
          </button>
        ) : null}
      </div>
      {footerActions ? <div className="flex items-center">{footerActions}</div> : null}
    </div>
  );
}

function BrandText({ brand, href }: { brand: string; href?: string }): React.JSX.Element {
  if (href) {
    return (
      <a
        href={href}
        className="rounded-sm transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        title="回到活動儀表板"
      >
        {brand}
      </a>
    );
  }
  return <span>{brand}</span>;
}

export function AppHeader({
  brand,
  brandHref,
  tagline,
  meta,
  brandAddon,
  taglineAddon,
  navItems,
  actions,
  onLogout,
  chromeFooterActions,
  subRow,
  logoutLabel = "登出",
  maxWidth = "7xl",
}: Props): React.JSX.Element {
  const hasNav = Boolean(navItems?.length || actions);
  const orgBranding = useOrgBranding();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/80 backdrop-blur-xl">
      <div className={`flex items-center gap-3 ${APP_HEADER_PADDING}`}>
        <div
          className={`flex min-w-0 flex-1 items-center justify-between gap-3 ${
            maxWidth === "full" ? "w-full" : `mx-auto w-full ${MAX_W[maxWidth]}`
          }`}
        >
          <div className="min-w-0">
            {orgBranding ? (
              <div className="mb-1">
                <OrgBrandMark
                  fallback="LiveEngage"
                  className="font-display text-xs font-semibold tracking-wide text-muted"
                />
              </div>
            ) : null}
            <h1 className="flex flex-wrap items-center gap-x-2 font-display text-lg font-bold tracking-tight text-foreground">
              <BrandText brand={brand} {...(brandHref ? { href: brandHref } : {})} />
              {brandAddon}
            </h1>
            {tagline ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
                <p className="truncate text-xs text-muted">{tagline}</p>
                {taglineAddon}
              </div>
            ) : taglineAddon ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2">{taglineAddon}</div>
            ) : null}
            {meta ? <div className="mt-0.5 font-mono text-[10px] text-muted">{meta}</div> : null}
          </div>

          {hasNav ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {navItems?.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`le-nav-link ${item.active ? "le-nav-link-active" : ""}`}
                >
                  {item.label}
                </a>
              ))}
              {actions}
            </div>
          ) : null}
        </div>

        <AppHeaderChrome
          {...(onLogout ? { onLogout, logoutLabel } : { logoutLabel })}
          {...(chromeFooterActions ? { footerActions: chromeFooterActions } : {})}
        />
      </div>
      {subRow ? (
        <div className={`border-t border-border/60 ${APP_HEADER_PADDING} pb-2.5 pt-2`}>
          <div
            className={
              maxWidth === "full" ? "w-full" : `mx-auto w-full ${MAX_W[maxWidth]}`
            }
          >
            {subRow}
          </div>
        </div>
      ) : null}
    </header>
  );
}
