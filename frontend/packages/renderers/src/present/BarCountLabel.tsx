import * as React from "react";
import { useEffect, useRef } from "react";
import type { LabelProps } from "recharts";

export interface BarCountLabelProps extends LabelProps {
  large?: boolean;
  bump?: boolean;
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
  const groupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group || !bump) return;

    group.style.transformOrigin = "center";
    group.style.transition = "transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)";
    group.style.transform = "scale(1)";

    const raf = window.requestAnimationFrame(() => {
      group.style.transform = "scale(1.42)";
      window.setTimeout(() => {
        group.style.transform = "scale(1)";
      }, 120);
    });

    return () => window.cancelAnimationFrame(raf);
  }, [bump, count]);

  if (!Number.isFinite(count) || count <= 0) return null;

  const w = Number(width ?? 0);
  const h = Number(height ?? 0);
  if (w < 4 || h < 4) return null;

  const cx = Number(x ?? 0) + w / 2;
  const cy = Number(y ?? 0) + h / 2;
  const fontSize = large ? Math.min(24, Math.max(14, h * 0.55)) : Math.min(16, Math.max(11, h * 0.5));

  return (
    <g ref={groupRef} transform={`translate(${cx}, ${cy})`}>
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
          stroke: large ? "rgba(15, 23, 42, 0.35)" : "rgba(15, 23, 42, 0.25)",
          strokeWidth: large ? 3 : 2,
        }}
      >
        {count}
      </text>
    </g>
  );
}
