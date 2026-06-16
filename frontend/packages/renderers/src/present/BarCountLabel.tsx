import * as React from "react";
import type { LabelProps } from "recharts";
import "./barCountLabel.css";

export interface BarCountLabelProps extends LabelProps {
  large?: boolean;
  bump?: boolean;
}

/** 相對舊版（11–16 / 14–24）各加 25px，供 Host／投影遠距閱讀。 */
const FONT_LARGE = { min: 39, max: 49, scale: 0.55, offset: 25 };
const FONT_DEFAULT = { min: 36, max: 41, scale: 0.5, offset: 25 };

function barCountFontSize(h: number, large: boolean): number {
  const spec = large ? FONT_LARGE : FONT_DEFAULT;
  return Math.min(spec.max, Math.max(spec.min, h * spec.scale + spec.offset));
}

export function BarCountLabel({
  x,
  y,
  width,
  height,
  value,
  large = false,
  bump = false,
}: BarCountLabelProps): React.JSX.Element | null {
  const count = Number(value ?? 0);

  if (!Number.isFinite(count) || count <= 0) return null;

  const w = Number(width ?? 0);
  const h = Number(height ?? 0);
  if (w < 4 || h < 4) return null;

  const cx = Number(x ?? 0) + w / 2;
  const cy = Number(y ?? 0) + h / 2;
  const fontSize = barCountFontSize(h, large);
  const strokeWidth = large ? 4 : 3;

  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <g
        key={bump ? `bump-${count}` : `still-${count}`}
        className={bump ? "le-bar-count-bump" : undefined}
      >
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize={fontSize}
          fontWeight={700}
          style={{
            pointerEvents: "none",
            paintOrder: "stroke fill",
            stroke: large ? "rgba(15, 23, 42, 0.4)" : "rgba(15, 23, 42, 0.3)",
            strokeWidth,
          }}
        >
          {count}
        </text>
      </g>
    </g>
  );
}
