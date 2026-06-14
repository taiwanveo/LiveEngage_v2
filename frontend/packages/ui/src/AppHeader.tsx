/** 應用頂部導覽列（Host / Participant / Admin / Present 共用）。 */

import * as React from "react";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface NavItem {
  href: string;
  label: string;
  active?: boolean;
}

interface Props {
  brand: string;
  tagline?: string;
  meta?: React.ReactNode;
  /** 標題右側附加控制（如「重新整理」） */
  brandAddon?: React.ReactNode;
  navItems?: NavItem[];
  actions?: React.ReactNode;
  onLogout?: () => void;
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
}: {
  onLogout?: () => void;
  logoutLabel?: string;
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-2" aria-label="顯示設定與帳號">
      <ThemeSwitcher compact />
      {onLogout ? (
        <button type="button" onClick={onLogout} className="le-btn-ghost !min-h-[40px]">
          {logoutLabel}
        </button>
      ) : null}
    </div>
  );
}

export function AppHeader({
  brand,
  tagline,
  meta,
  brandAddon,
  navItems,
  actions,
  onLogout,
  logoutLabel = "登出",
  maxWidth = "7xl",
}: Props): React.JSX.Element {
  const hasNav = Boolean(navItems?.length || actions);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/80 backdrop-blur-xl">
      <div className={`flex items-center gap-3 ${APP_HEADER_PADDING}`}>
        <div
          className={`flex min-w-0 flex-1 items-center justify-between gap-3 ${
            maxWidth === "full" ? "w-full" : `mx-auto w-full ${MAX_W[maxWidth]}`
          }`}
        >
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-x-2 font-display text-lg font-bold tracking-tight text-foreground">
              <span>{brand}</span>
              {brandAddon}
            </h1>
            {tagline ? (
              <p className="truncate text-xs text-muted">{tagline}</p>
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

        <AppHeaderChrome {...(onLogout ? { onLogout, logoutLabel } : { logoutLabel })} />
      </div>
    </header>
  );
}
