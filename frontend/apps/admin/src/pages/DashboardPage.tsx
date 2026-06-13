import * as React from "react";
import { AdminShell } from "../components/AdminShell";
import { NAV_ITEMS } from "../lib/nav";

interface Props {
  onLogout: () => void;
}

export function DashboardPage({ onLogout }: Props): React.JSX.Element {
  return (
    <AdminShell active="dashboard" onLogout={onLogout}>
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">總覽</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sprint 7-1 管理後台骨架；以下模組將陸續接 API。
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_ITEMS.filter((i) => i.id !== "dashboard").map((item) => (
            <a
              key={item.id}
              href={item.hash}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-xs font-medium text-primary-600">{item.sprint}</p>
              <h3 className="mt-1 font-semibold text-slate-900">{item.label}</h3>
              <p className="mt-2 text-sm text-slate-500">{item.description}</p>
            </a>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
