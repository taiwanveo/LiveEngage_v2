import * as React from "react";
import type { OptionCount, PollOption } from "../types";

interface ResultBarsProps {
  options: PollOption[];
  counts: OptionCount[];
  large?: boolean;
  /** 揭曉結果後顯示正解標記（參與者／工作台預覽） */
  showCorrectAnswer?: boolean;
}

export function ResultBars({
  options,
  counts,
  large = false,
  showCorrectAnswer = false,
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
              <span className="flex shrink-0 items-center gap-2">
                {showCorrectAnswer && opt.is_correct ? (
                  <span className="text-xs text-emerald-600">正解</span>
                ) : null}
                <span className="tabular-nums text-muted">{count}</span>
              </span>
            </div>
            <div
              className={
                large
                  ? "h-4 overflow-hidden rounded-full bg-white/10"
                  : "h-2 overflow-hidden rounded-full bg-surface-elevated"
              }
            >
              <div
                className={
                  large
                    ? "h-full rounded-full bg-primary-500 transition-all"
                    : "h-full rounded-full bg-accent transition-all"
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
