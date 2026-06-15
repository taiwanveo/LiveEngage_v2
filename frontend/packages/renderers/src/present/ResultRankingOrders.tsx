/** 排序題結果：排列組合統計（僅顯示有票數的組合）。 */

import * as React from "react";
import type { RankingOrderCount } from "../types";

interface Props {
  orders: RankingOrderCount[];
  large?: boolean;
}

function formatOrderKey(orderKey: string): string {
  const parts = orderKey.split(",");
  if (parts.every((p) => p.length === 1)) {
    return parts.join("");
  }
  return parts.join(" · ");
}

export function ResultRankingOrders({
  orders,
  large = false,
}: Props): React.JSX.Element {
  const max = Math.max(1, ...orders.map((o) => o.count));

  return (
    <ul className={`space-y-3 ${large ? "text-lg" : "text-sm"}`}>
      {orders.map((order) => {
        const pct = Math.round(order.percentage);
        const barPct = Math.round((order.count / max) * 100);
        const labelText =
          order.order_labels.length > 0
            ? order.order_labels.join(" → ")
            : formatOrderKey(order.order_key);
        return (
          <li key={order.order_key}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                <span className="mr-2 font-mono text-xs text-slate-500">
                  {formatOrderKey(order.order_key)}
                </span>
                {labelText}
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {order.count} 票（{pct}%）
              </span>
            </div>
            <div
              className={
                large
                  ? "h-4 overflow-hidden rounded-full bg-white/10"
                  : "h-2 overflow-hidden rounded-full bg-slate-100"
              }
            >
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${barPct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
