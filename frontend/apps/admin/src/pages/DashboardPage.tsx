import * as React from "react";
import { AdminShell } from "../components/AdminShell";
import { NAV_ITEMS } from "../lib/nav";

interface Props {
  onLogout: () => void;
}

export function DashboardPage({ onLogout }: Props): React.JSX.Element {
  return (
    <AdminShell active="dashboard" onLogout={onLogout}>
      <div className="mx-auto max-w-5xl animate-slide-up">
        <header className="mb-8">
          <h2 className="font-display text-3xl font-bold text-foreground">總覽</h2>
          <p className="mt-2 text-sm text-muted">
            組織營運中樞 — 成員、活動稽核、匯出與品牌設定一站管理。
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_ITEMS.filter((i) => i.id !== "dashboard").map((item) => (
            <a
              key={item.id}
              href={item.hash}
              className="le-card group p-5 transition-shadow hover:shadow-elevated"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-accent">
                {item.sprint}
              </p>
              <h3 className="mt-2 font-display text-lg font-semibold text-foreground group-hover:text-accent">
                {item.label}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
            </a>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
