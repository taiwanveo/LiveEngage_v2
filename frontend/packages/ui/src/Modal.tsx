/** 置中 modal 對話框（portal 至 body，backdrop 點擊關閉）。 */

import * as React from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 預設 md */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  /** 底部顯示「關閉」按鈕（預設 true，若提供 footer 則不顯示） */
  showCloseButton?: boolean;
  closeLabel?: string;
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  showCloseButton = true,
  closeLabel = "關閉",
}: ModalProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="le-modal-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="關閉"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className={`relative z-[1] flex w-full max-h-[calc(100dvh-2rem)] flex-col overflow-hidden ${SIZE_CLASS[size]} animate-slide-up rounded-xl border border-border bg-surface shadow-elevated`}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
            <h2 id="le-modal-title" className="font-display text-base font-semibold text-foreground">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="le-btn-ghost shrink-0 !min-h-[32px] !px-2.5 !text-sm text-muted"
              aria-label="關閉"
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer ? (
            <div className="shrink-0 border-t border-border px-5 py-3.5 bg-surface">{footer}</div>
          ) : showCloseButton ? (
            <div className="flex shrink-0 justify-end border-t border-border px-5 py-4">
              <button type="button" onClick={onClose} className="le-btn-secondary !min-h-[36px]">
                {closeLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
