import * as React from "react";
import type { OptionCount, PollOption } from "../types";

interface ResultBarsProps {
  options: PollOption[];
  counts: OptionCount[];
  large?: boolean;
}

export function ResultBars({
  options,
  counts,
  large = false,
}: ResultBarsProps): React.JSX.Element {
  const countMap = new Map(counts.map((c) => [c.option_id, c.count]));
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <ul className={`space-y-3 ${large ? "text-lg" : "text-sm"}`}>
      {options.map((opt) => {
        const count = countMap.get(opt.id) ?? 0;
        const pct = Math.round((count / max) * 100);
        return (
          <li key={opt.id}>
            <div className="mb-1 flex justify-between gap-2">
              <span className="font-medium">{opt.text}</span>
              <span className="tabular-nums text-slate-500">{count}</span>
            </div>
            <div
              className={
                large
                  ? "h-4 overflow-hidden rounded-full bg-white/10"
                  : "h-2 overflow-hidden rounded-full bg-slate-100"
              }
            >
              <div
                className={
                  large
                    ? "h-full rounded-full bg-primary-500 transition-all"
                    : "h-full rounded-full bg-primary-500 transition-all"
                }
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
