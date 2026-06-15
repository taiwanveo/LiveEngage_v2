/** 投影按鈕：accent 填色、白字、圖示、一律另開新視窗。 */

import * as React from "react";
import { PresentIcon } from "./icons";
import { openPresentWindow } from "./presentWindow";

export interface PresentButtonProps {
  href: string;
  /** 頂欄精簡版（圖示較大） */
  compact?: boolean;
  className?: string;
  title?: string;
}

export function PresentButton({
  href,
  compact = false,
  className,
  title = "另開新視窗投影",
}: PresentButtonProps): React.JSX.Element {
  const iconSize = compact ? 24 : 16;

  return (
    <button
      type="button"
      title={title}
      onClick={() => openPresentWindow(href)}
      className={[
        "le-btn-primary",
        compact ? "le-btn-present-compact" : "le-btn-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <PresentIcon size={iconSize} />
      <span>投影</span>
    </button>
  );
}

/** 列表列上的投影連結（與頂欄精簡投影同尺寸）。 */
export function PresentListAction({
  href,
  className,
  title = "另開新視窗投影",
  compact = true,
}: {
  href: string;
  className?: string;
  title?: string;
  compact?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={() => openPresentWindow(href)}
      className={[
        "le-btn-primary",
        compact ? "le-btn-present-compact" : "le-btn-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <PresentIcon size={compact ? 14 : 16} />
      <span>投影</span>
    </button>
  );
}
