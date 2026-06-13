/** 應用頂部導覽列（Host / Participant / Admin 共用模式）。 */

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
  navItems?: NavItem[];
  actions?: React.ReactNode;
  onLogout?: () => void;
  maxWidth?: "2xl" | "4xl" | "6xl" | "7xl" | "full";
}

const MAX_W: Record<NonNullable<Props["maxWidth"]>, string> = {
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

export function AppHeader({
  brand,
  tagline,
  meta,
  navItems,
  actions,
  onLogout,
  maxWidth = "7xl",
}: Props): React.JSX.Element {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/80 backdrop-blur-xl">
      <div
        className={`mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 ${MAX_W[maxWidth]}`}
      >
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">
            {brand}
          </h1>
          {tagline ? (
            <p className="truncate text-xs text-muted">{tagline}</p>
          ) : null}
          {meta ? <div className="mt-0.5 font-mono text-[10px] text-muted">{meta}</div> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <ThemeSwitcher compact />
          {onLogout ? (
            <button type="button" onClick={onLogout} className="le-btn-ghost !min-h-[40px]">
              登出
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
