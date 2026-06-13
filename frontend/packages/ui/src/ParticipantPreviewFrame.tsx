/** 參與者模式預覽框（手機外框 + 內容）。 */

import * as React from "react";

export interface ParticipantPreviewFrameProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function ParticipantPreviewFrame({
  title = "Participant mode",
  subtitle,
  children,
  footer,
}: ParticipantPreviewFrameProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
          {subtitle ? <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p> : null}
        </div>
        <span className="le-status-dot le-status-dot-live" title="即時" />
      </div>
      <div className="mx-auto w-full max-w-[280px] flex-1">
        <div className="overflow-hidden rounded-[1.75rem] border-[6px] border-border bg-surface shadow-elevated">
          <div className="flex items-center justify-between bg-accent px-3 py-2 text-accent-fg">
            <span className="text-[10px] font-medium opacity-90">LiveEngage</span>
            <span className="h-2 w-2 rounded-full bg-accent-fg/80" />
          </div>
          <div className="max-h-[420px] overflow-y-auto bg-surface p-3">{children}</div>
        </div>
      </div>
      {footer ? <div className="mt-3 text-center text-[11px] text-muted">{footer}</div> : null}
    </div>
  );
}
