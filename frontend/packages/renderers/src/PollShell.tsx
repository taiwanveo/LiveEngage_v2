import * as React from "react";
import type { InteractionStatus, RenderMode } from "./types";
import { modeLabel, presentStatusBadgeClass, statusLabel } from "./utils";

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
          ? "flex min-h-0 flex-1 flex-col text-white"
          : "le-card p-6"
      }
    >
      <header className={isPresent ? "mb-6 shrink-0 space-y-2" : "mb-6 space-y-2"}>
        <div className="flex flex-wrap items-center gap-2">
          {!isPresent ? (
            <span className="rounded-full bg-surface-elevated px-3 py-1 text-xs font-medium text-muted">
              {modeLabel(mode)}
            </span>
          ) : null}
          <span
            className={
              isPresent
                ? presentStatusBadgeClass(status)
                : "rounded-full bg-accent-muted px-3 py-1 text-xs font-medium text-accent"
            }
          >
            {statusLabel(status)}
          </span>
        </div>
        <h2
          className={
            isPresent
              ? "text-3xl font-bold tracking-tight md:text-4xl"
              : "text-xl font-semibold text-foreground"
          }
        >
          {title ?? "未命名題目"}
        </h2>
        {description ? (
          <p
            className={
              isPresent
                ? "text-lg text-slate-300"
                : "text-sm text-muted"
            }
          >
            {description}
          </p>
        ) : null}
      </header>
      <div className={isPresent ? "flex min-h-0 flex-1 flex-col space-y-4" : "space-y-4"}>
        {children}
      </div>
      {footer ? <footer className="mt-6">{footer}</footer> : null}
    </article>
  );
}
