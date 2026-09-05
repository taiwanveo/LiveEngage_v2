import * as React from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RatingBarChartProps {
  average: number | null | undefined;
  distribution: Record<string, number> | null | undefined;
  min: number;
  max: number;
  large?: boolean;
}

export function RatingBarChart({
  average,
  distribution,
  min,
  max,
  large = false,
}: RatingBarChartProps): React.JSX.Element {
  const dist = distribution ?? {};
  const data = Array.from({ length: max - min + 1 }, (_, i) => {
    const value = min + i;
    return { label: String(value), count: dist[String(value)] ?? 0 };
  });

  const height = large ? 240 : 180;
  const tickFill = large ? "#cbd5e1" : "#64748b";

  return (
    <div className="space-y-4">
      {average != null ? (
        <p className={large ? "text-5xl font-bold text-foreground" : "text-3xl font-bold text-foreground"}>
          {average.toFixed(1)}
          <span
            className={
              large ? "ml-2 text-2xl text-muted" : "ml-2 text-base text-muted"
            }
          >
            / {max}
          </span>
        </p>
      ) : null}
      <div style={{ width: "100%", height }} aria-label="評分分布圖">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: tickFill, fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: tickFill, fontSize: 12 }} />
            <Tooltip
              contentStyle={
                large
                  ? { background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" }
                  : undefined
              }
            />
            <Bar dataKey="count" fill={large ? "#fbbf24" : "#f59e0b"} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
