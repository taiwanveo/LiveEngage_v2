import * as React from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OptionCount, PollOption } from "../types";

interface ResultBarChartProps {
  options: PollOption[];
  counts: OptionCount[];
  large?: boolean;
}

export function ResultBarChart({
  options,
  counts,
  large = false,
}: ResultBarChartProps): React.JSX.Element {
  const countMap = new Map(counts.map((c) => [c.option_id, c.count]));
  const data = options.map((opt) => ({
    name: opt.text,
    count: countMap.get(opt.id) ?? 0,
  }));

  const height = large ? 280 : 200;
  const tickFill = large ? "#cbd5e1" : "#64748b";
  const barFill = large ? "#3b82f6" : "#2563eb";

  return (
    <div style={{ width: "100%", height }} aria-label="結果長條圖">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" tick={{ fill: tickFill, fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={large ? 140 : 100}
            tick={{ fill: tickFill, fontSize: large ? 14 : 12 }}
          />
          <Tooltip
            contentStyle={
              large
                ? { background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" }
                : undefined
            }
          />
          <Bar dataKey="count" fill={barFill} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
