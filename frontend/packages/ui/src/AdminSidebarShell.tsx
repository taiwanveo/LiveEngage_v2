/** 管理後台側欄外殼 — 語意 token + 主題切換。 */

import * as React from "react";
import { ThemeSwitcher } from "./ThemeSwitcher";

export interface SidebarNavItem {
  id: string;
  href: string;
  label: string;
}

interface Props {
  brand?: string;
  tagline?: string;
  activeId: string;
  navItems: SidebarNavItem[];
  onLogout: () => void;
  children: React.ReactNode;
}

export function AdminSidebarShell({
  brand = "LiveEngage",
  tagline = "管理後台（admin）",
  activeId,
  navItems,
  onLogout,
  children,
}: Props): React.JSX.Element {
  return (
    <div className="le-page-bg flex min-h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border/80 bg-surface/90 backdrop-blur-xl">
        <div className="border-b border-border px-5 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            Console
          </p>
          <h1 className="font-display text-base font-bold text-foreground">{brand}</h1>
          <p className="mt-0.5 text-xs text-muted">{tagline}</p>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="管理導覽">
          {navItems.map((item) => {
            const isActive = item.id === activeId;
            return (
              <a
                key={item.id}
                href={item.href}
                className={`block rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "le-nav-link-active font-semibold"
                    : "le-nav-link !min-h-0 w-full"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border p-3">
          <ThemeSwitcher />
          <button type="button" onClick={onLogout} className="le-btn-ghost w-full !justify-start">
            登出（sign out）
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
