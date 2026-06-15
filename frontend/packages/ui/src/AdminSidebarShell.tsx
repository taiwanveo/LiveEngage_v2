/** 管理後台側欄外殼 — 頂欄與 Host/Participant/Present 對齊。 */

import * as React from "react";
import { AppHeader } from "./AppHeader";

export interface SidebarNavItem {
  id: string;
  href: string;
  label: string;
}

interface Props {
  brand?: string;
  activeId: string;
  navItems: SidebarNavItem[];
  onLogout: () => void;
  children: React.ReactNode;
}

export function AdminSidebarShell({
  brand = "LiveEngage 管理後台",
  activeId,
  navItems,
  onLogout,
  children,
}: Props): React.JSX.Element {
  return (
    <div className="le-page-bg flex min-h-full flex-col">
      <AppHeader
        brand={brand}
        onLogout={onLogout}
        maxWidth="full"
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[7.5rem] shrink-0 flex-col border-r border-border/80 bg-surface/90 backdrop-blur-xl">
          <nav className="flex-1 space-y-1 p-2 pt-4" aria-label="管理導覽">
            {navItems.map((item) => {
              const isActive = item.id === activeId;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className={`block rounded-xl px-2 py-2 text-sm transition-colors ${
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
        </aside>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <main className="flex-1 overflow-y-auto p-3 md:p-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
