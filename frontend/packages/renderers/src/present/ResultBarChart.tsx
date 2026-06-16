import * as React from "react";
import { useCallback, useMemo } from "react";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OptionCount, PollOption } from "../types";
import { BarCountLabel } from "./BarCountLabel";
import { buildCountAxisTicks, countAxisMax } from "./chartUtils";
import { useCountBumps } from "./useCountBumps";

interface ResultBarChartProps {
  options: PollOption[];
  counts: OptionCount[];
  large?: boolean;
  /** 揭曉結果後於選項文字左側顯示「正解」 */
  showCorrectAnswer?: boolean;
}

function CategoryAxisTick(props: {
  x?: number;
  y?: number;
  payload?: { value: string; index: number };
  options: PollOption[];
  showCorrectAnswer: boolean;
  tickFill: string;
  fontSize: number;
}): React.JSX.Element {
  const { x = 0, y = 0, payload, options, showCorrectAnswer, tickFill, fontSize } = props;
  const label = payload?.value ?? "";
  const opt = payload != null ? options[payload.index] : undefined;
  const showBadge = showCorrectAnswer && opt?.is_correct === true;

  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={tickFill} fontSize={fontSize}>
      {showBadge ? (
        <>
          <tspan fill="#10b981" fontWeight={600}>
            正解{" "}
          </tspan>
          <tspan fill={tickFill}>{label}</tspan>
        </>
      ) : (
        label
      )}
    </text>
  );
}

export function ResultBarChart({
  options,
  counts,
  large = false,
  showCorrectAnswer = false,
}: ResultBarChartProps): React.JSX.Element {
  const countMap = new Map(counts.map((c) => [c.option_id, c.count]));
  const data = useMemo(
    () =>
      options.map((opt) => ({
        name: opt.text,
        count: countMap.get(opt.id) ?? 0,
      })),
    [options, counts]
  );
  const countValues = useMemo(() => data.map((row) => row.count), [data]);
  const countBumps = useCountBumps(countValues);
  const axisMax = countAxisMax(data.map((row) => row.count));
  const axisTicks = buildCountAxisTicks(axisMax);

  const height = large ? 320 : 200;
  const isLightTheme =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "light";
  const tickFill = large ? (isLightTheme ? "#334155" : "#cbd5e1") : "#64748b";
  const barFill = large ? "#3b82f6" : "#2563eb";
  const yAxisWidth = large
    ? showCorrectAnswer
      ? 180
      : 140
    : showCorrectAnswer
      ? 120
      : 100;

  const renderBarLabel = useCallback(
    (labelProps: React.ComponentProps<typeof BarCountLabel>) => (
      <BarCountLabel
        {...labelProps}
        large={large}
        bump={countBumps[labelProps.index ?? 0] ?? false}
      />
    ),
    [large, countBumps]
  );

  return (
    <div style={{ width: "100%", height }} aria-label="結果長條圖">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis
            type="number"
            allowDecimals={false}
            domain={[0, axisMax]}
            ticks={axisTicks}
            tick={{ fill: tickFill, fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            tick={(tickProps) => (
              <CategoryAxisTick
                {...tickProps}
                options={options}
                showCorrectAnswer={showCorrectAnswer}
                tickFill={tickFill}
                fontSize={large ? 14 : 12}
              />
            )}
          />
          <Tooltip
            contentStyle={
              large
                ? { background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" }
                : undefined
            }
          />
          <Bar
            dataKey="count"
            fill={barFill}
            radius={[0, 4, 4, 0]}
            isAnimationActive
            animationDuration={480}
            animationEasing="ease-out"
          >
            <LabelList content={renderBarLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
