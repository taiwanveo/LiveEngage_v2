import * as React from "react";

interface RatingDisplayProps {
  average: number | null | undefined;
  distribution: Record<string, number> | null | undefined;
  min: number;
  max: number;
  large?: boolean;
}

export function RatingDisplay({
  average,
  distribution,
  min,
  max,
  large = false,
}: RatingDisplayProps): React.JSX.Element {
  const dist = distribution ?? {};
  const maxCount = Math.max(1, ...Object.values(dist));

  return (
    <div className="space-y-4">
      {average != null ? (
        <p className={large ? "text-5xl font-bold" : "text-3xl font-bold"}>
          {average.toFixed(1)}
          <span className={large ? "ml-2 text-2xl text-slate-300" : "ml-2 text-base text-slate-500"}>
            / {max}
          </span>
        </p>
      ) : null}
      <ul className="space-y-2">
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((value) => {
          const count = dist[String(value)] ?? 0;
          const pct = Math.round((count / maxCount) * 100);
          return (
            <li key={value} className="flex items-center gap-3 text-sm">
              <span className="w-6 tabular-nums">{value}</span>
              <div
                className={
                  large
                    ? "h-3 flex-1 overflow-hidden rounded-full bg-white/10"
                    : "h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
                }
              >
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums text-slate-500">
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
