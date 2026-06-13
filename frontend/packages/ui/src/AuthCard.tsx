/** 登入／加入頁共用卡片外殼。 */

import * as React from "react";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: Props): React.JSX.Element {
  return (
    <main className="le-page-bg flex min-h-full items-center justify-center px-4 py-12">
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="mb-4 flex justify-end">
          <ThemeSwitcher compact />
        </div>
        <div className="le-card-elevated p-8 md:p-10">
          <header className="mb-8 space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              LiveEngage
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm leading-relaxed text-muted">{subtitle}</p>
            ) : null}
          </header>
          {children}
          {footer ? (
            <footer className="mt-6 border-t border-border pt-4 text-xs text-muted">
              {footer}
            </footer>
          ) : null}
        </div>
      </div>
    </main>
  );
}
