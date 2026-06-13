/** Sprint 7 佔位頁：標示待實作範圍與對應 BE 編號。 */

import * as React from "react";
import type { NavItem } from "../lib/nav";

interface Props {
  item: NavItem;
}

export function PlaceholderPage({ item }: Props): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-600">
          {item.sprint} · 待實作
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">{item.label}</h2>
        <p className="mt-2 text-sm text-slate-600">{item.description}</p>
      </header>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">
          此功能將於 Sprint 7 後續切片接後端 API 與完整 UI。
        </p>
      </div>
    </div>
  );
}
