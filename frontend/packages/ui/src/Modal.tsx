/** 置中 modal 對話框（backdrop 點擊關閉）。 */

import * as React from "react";
import { useEffect } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** 預設 sm */
  size?: "sm" | "md";
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
}: ModalProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
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
        className={`relative w-full ${SIZE_CLASS[size]} animate-slide-up rounded-xl border border-border bg-surface p-5 shadow-elevated`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="le-modal-title" className="font-display text-base font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="le-btn-ghost !min-h-[28px] !px-2 !text-lg leading-none text-muted"
            aria-label="關閉"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
