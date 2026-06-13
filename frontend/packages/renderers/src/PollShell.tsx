import * as React from "react";
import type { InteractionStatus, RenderMode } from "./types";
import { modeLabel, statusLabel } from "./utils";

interface PollShellProps {
  mode: RenderMode;
  status: InteractionStatus;
  title: string | null;
  description: string | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function PollShell({
  mode,
  status,
  title,
  description,
  children,
  footer,
}: PollShellProps): React.JSX.Element {
  const isPresent = mode === "present";

  return (
    <article
      className={
        isPresent
          ? "rounded-2xl bg-slate-900 p-8 text-white shadow-xl"
          : "rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      }
    >
      <header className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              isPresent
                ? "rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200"
                : "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
            }
          >
            {modeLabel(mode)}
          </span>
          <span
            className={
              isPresent
                ? "rounded-full bg-primary-500/20 px-3 py-1 text-xs font-medium text-primary-50"
                : "rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
            }
          >
            {statusLabel(status)}
          </span>
        </div>
        <h2
          className={
            isPresent
              ? "text-3xl font-bold tracking-tight md:text-4xl"
              : "text-xl font-semibold text-slate-900"
          }
        >
          {title ?? "未命名題目"}
        </h2>
        {description ? (
          <p
            className={
              isPresent
                ? "text-lg text-slate-300"
                : "text-sm text-slate-600"
            }
          >
            {description}
          </p>
        ) : null}
      </header>
      <div className="space-y-4">{children}</div>
      {footer ? <footer className="mt-6">{footer}</footer> : null}
    </article>
  );
}
