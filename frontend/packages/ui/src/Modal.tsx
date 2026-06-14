/** 置中 modal 對話框（portal 至 body，backdrop 點擊關閉）。 */

import * as React from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** 預設 sm */
  size?: "sm" | "md";
  /** 底部顯示「關閉」按鈕（預設 true） */
  showCloseButton?: boolean;
  closeLabel?: string;
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
};

export function Modal({
  open,
  onClose,
  title,
  children,
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
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="le-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="關閉"
        onClick={onClose}
      />
      <div
        className={`relative z-[1] max-h-[min(90vh,640px)] w-full overflow-y-auto ${SIZE_CLASS[size]} animate-slide-up rounded-xl border border-border bg-surface p-5 shadow-elevated`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
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
        {children}
        {showCloseButton ? (
          <div className="mt-5 flex justify-end border-t border-border pt-4">
            <button type="button" onClick={onClose} className="le-btn-secondary !min-h-[36px]">
              {closeLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
