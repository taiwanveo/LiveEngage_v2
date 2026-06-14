/** 參與者模式預覽框（手機外框 + 內容，適合工作台右欄）。 */

import * as React from "react";
import { useEffect, useState } from "react";

export interface ParticipantPreviewFrameProps {
  title?: string;
  subtitle?: string;
  /** 顯示於手機預覽上方的摘要（例如回應數） */
  stats?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** 狀態列即時時鐘；冒號每秒閃爍一次。 */
function PreviewStatusClock(): React.JSX.Element {
  const [parts, setParts] = useState(() => formatClockParts(new Date()));
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    const tick = (): void => {
      setParts(formatClockParts(new Date()));
      setColonVisible((v) => !v);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="tabular-nums tracking-tight">
      {parts.hour}
      <span
        className="inline-block w-[0.35em] text-center transition-opacity duration-150"
        style={{ opacity: colonVisible ? 1 : 0.2 }}
        aria-hidden
      >
        :
      </span>
      {parts.minute}
    </span>
  );
}

function formatClockParts(date: Date): { hour: string; minute: string } {
  return {
    hour: String(date.getHours()),
    minute: date.getMinutes().toString().padStart(2, "0"),
  };
}

/** 手機螢幕內容區：貼齊寬度、去除巢狀卡片留白，模擬真實參與者畫面。 */
const PHONE_SCROLL_CLASS =
  "min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-2 pb-1 " +
  "[scrollbar-width:thin] [scrollbar-color:rgb(64_64_64)_transparent] " +
  "[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent " +
  "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-600 " +
  "[&::-webkit-scrollbar-thumb]:hover:bg-neutral-500 " +
  "[&>*]:w-full [&>*]:max-w-full " +
  "[&_article]:box-border [&_article]:!w-full [&_article]:!max-w-full " +
  "[&_article]:!rounded-none [&_article]:!border-0 [&_article]:!bg-transparent [&_article]:!p-0 [&_article]:!shadow-none " +
  "[&_header]:!mb-1.5 [&_header]:w-full " +
  "[&_header_div]:w-full " +
  "[&_header_span]:text-[3px] [&_header_span]:!px-1 [&_header_span]:!py-0.5 " +
  "[&_h2]:w-full [&_h2]:max-w-full [&_h2]:text-[8px] [&_h2]:leading-tight " +
  "[&_p]:w-full [&_p]:max-w-full [&_p]:text-[5px] [&_p]:leading-snug " +
  "[&_article>div]:w-full [&_ul]:w-full [&_li]:w-full " +
  "[&_label]:flex [&_label]:w-full [&_label]:min-w-0 [&_label]:max-w-full [&_label]:items-center [&_label]:gap-1 " +
  "[&_label]:!px-1.5 [&_label]:!py-1 [&_label]:text-[4px] " +
  "[&_label_span]:min-w-0 [&_label_span]:flex-1 [&_label_span]:truncate [&_label_span]:whitespace-nowrap " +
  "[&_label_input]:size-2 [&_label_input]:shrink-0 " +
  "[&_select]:w-full [&_select]:min-w-0 [&_select]:max-w-full [&_select]:truncate [&_select]:text-[4px] " +
  "[&_li>div]:w-full [&_li>div]:min-w-0 " +
  "[&_li>div_span:first-child]:min-w-0 [&_li>div_span:first-child]:flex-1 [&_li>div_span:first-child]:truncate [&_li>div_span:first-child]:whitespace-nowrap [&_li>div_span:first-child]:text-[4px] " +
  "[&_button]:block [&_button]:w-full [&_button]:max-w-full [&_button]:py-0.5 [&_button]:text-[5px]";

export function ParticipantPreviewFrame({
  title = "預覽參與者畫面",
  subtitle,
  stats,
  children,
  footer,
}: ParticipantPreviewFrameProps): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col p-2 sm:p-3">
      <div className="mb-2 shrink-0 text-center">
        <p className="text-[10px] font-semibold text-foreground">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 text-[10px] leading-snug text-muted">{subtitle}</p>
        ) : null}
      </div>

      {stats ? (
        <div className="mb-2 flex shrink-0 justify-center">
          <div className="w-2/3 rounded-lg border border-border bg-surface-elevated px-2 py-1 text-center">
            {stats}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto">
        {/* 長形手機外框（約 9:19.5） */}
        <div className="relative w-[10.5rem] shrink-0 sm:w-[11.25rem]">
          <div className="relative flex aspect-[9/19.5] flex-col rounded-[2rem] bg-neutral-950 p-[6px] shadow-elevated ring-1 ring-neutral-800">
            <div
              className="pointer-events-none absolute left-1/2 top-[9px] z-20 h-[11px] w-[36%] max-w-[3.75rem] -translate-x-1/2 rounded-full bg-neutral-950"
              aria-hidden
            />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.65rem] bg-surface">
              <div className="flex shrink-0 items-center justify-between bg-surface px-2.5 pb-0.5 pt-2 text-[7px] font-medium text-muted">
                <PreviewStatusClock />
                <div className="flex items-center gap-0.5" aria-hidden>
                  <SignalIcon />
                  <WifiIcon />
                  <BatteryIcon />
                </div>
              </div>
              <div className={PHONE_SCROLL_CLASS}>{children}</div>
              <div className="flex shrink-0 justify-center bg-surface pb-1.5 pt-0.5" aria-hidden>
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
    <svg
      width="10"
      height="8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BatteryIcon(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="8"
      viewBox="0 0 24 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="0.5" y="0.5" width="20" height="11" rx="2" />
      <rect x="2" y="2" width="14" height="8" rx="1" fill="currentColor" stroke="none" />
      <path d="M22 4v4" strokeLinecap="round" />
    </svg>
  );
}
