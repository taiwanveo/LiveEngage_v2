/** 管理後台共用外殼：側欄導覽 + 主內容區。 */

import * as React from "react";
import { NAV_ITEMS, type AdminRoute } from "../lib/nav";

interface Props {
  active: AdminRoute;
  onLogout: () => void;
  children: React.ReactNode;
}

export function AdminShell({
  active,
  onLogout,
  children,
}: Props): React.JSX.Element {
  return (
    <div className="flex min-h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <h1 className="text-sm font-bold text-slate-900">LiveEngage</h1>
          <p className="text-xs text-slate-500">管理後台（admin）</p>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === active;
            return (
              <a
                key={item.id}
                href={item.hash}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary-50 font-medium text-primary-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            登出（sign out）
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
