/** 工作台互動題狀態膠囊（右上角）。 */

import * as React from "react";
import { interactionStatusLabel, type InteractionStatus } from "../../lib/pollTypes";

export function workbenchInteractionStatusTone(
  status: InteractionStatus | string
): "accent" | "muted" {
  return status === "active" || status === "locked" ? "accent" : "muted";
}

interface Props {
  status: InteractionStatus | string;
  /** 覆寫顯示文字（預設為互動狀態中文標籤） */
  label?: string;
}

export function WorkbenchInteractionStatusBadge({
  status,
  label,
}: Props): React.JSX.Element {
  const text = label ?? interactionStatusLabel(status);
  const tone = workbenchInteractionStatusTone(status);

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium leading-tight ${
        tone === "accent" ? "bg-accent/15 text-accent" : "bg-muted/20 text-muted"
      }`}
    >
      {text}
    </span>
  );
}
