/** 參與者模式預覽框（手機外框 + 內容，適合窄欄 15% 寬）。 */

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
    <div className="flex h-full min-h-0 flex-col p-2 sm:p-3">
      <div className="mb-2 shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{title}</p>
        {subtitle ? <p className="mt-0.5 text-[10px] leading-snug text-muted">{subtitle}</p> : null}
      </div>

      <div className="flex min-h-0 flex-1 items-start justify-center">
        <div className="relative w-full max-w-[11rem]">
          {/* 手機外框 */}
          <div className="relative rounded-[1.6rem] bg-neutral-950 p-[5px] shadow-elevated ring-1 ring-neutral-800">
            {/* 動態島 / 瀏海 */}
            <div
              className="pointer-events-none absolute left-1/2 top-[7px] z-20 h-[10px] w-[38%] max-w-[3.5rem] -translate-x-1/2 rounded-full bg-neutral-950"
              aria-hidden
            />
            {/* 螢幕 */}
            <div className="relative overflow-hidden rounded-[1.35rem] bg-surface">
              {/* 狀態列 */}
              <div className="flex items-center justify-between bg-surface px-2.5 pb-0.5 pt-1.5 text-[7px] font-medium text-muted">
                <span>9:41</span>
                <div className="flex items-center gap-0.5" aria-hidden>
                  <SignalIcon />
                  <WifiIcon />
                  <BatteryIcon />
                </div>
              </div>
              {/* 內容（縮放以適應窄螢幕） */}
              <div className="max-h-[min(52vh,22rem)] overflow-y-auto overscroll-contain px-1.5 pb-1 [&_*]:text-[11px] [&_h2]:text-sm [&_button]:text-[10px] [&_button]:py-1.5">
                {children}
              </div>
              {/* Home indicator */}
              <div className="flex justify-center bg-surface pb-1.5 pt-0.5" aria-hidden>
                <div className="h-[3px] w-[28%] rounded-full bg-muted/40" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {footer ? (
        <div className="mt-2 shrink-0 text-center text-[10px] text-muted">{footer}</div>
      ) : null}
    </div>
  );
}

function SignalIcon(): React.JSX.Element {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="currentColor" aria-hidden>
      <rect x="0" y="5" width="1.5" height="3" rx="0.3" />
      <rect x="2.5" y="3.5" width="1.5" height="4.5" rx="0.3" />
      <rect x="5" y="2" width="1.5" height="6" rx="0.3" />
      <rect x="7.5" y="0" width="1.5" height="8" rx="0.3" />
    </svg>
  );
}

function WifiIcon(): React.JSX.Element {
  return (
    <svg width="10" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BatteryIcon(): React.JSX.Element {
  return (
    <svg width="14" height="8" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="0.5" y="0.5" width="20" height="11" rx="2" />
      <rect x="2" y="2" width="14" height="8" rx="1" fill="currentColor" stroke="none" />
      <path d="M22 4v4" strokeLinecap="round" />
    </svg>
  );
}
