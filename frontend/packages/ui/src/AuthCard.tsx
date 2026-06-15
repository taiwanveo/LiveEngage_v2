/** 登入／加入頁共用卡片外殼（頂欄主題切換與四端對齊）。 */

import * as React from "react";
import { AppHeader } from "./AppHeader";
import { OrgBrandMark, useOrgBranding } from "./orgBranding";

interface Props {
  title: string;
  subtitle?: string;
  /** AppHeader 副標（例如「主持人工作台（host）」） */
  appTagline?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({
  title,
  subtitle,
  appTagline = "LiveEngage",
  children,
  footer,
}: Props): React.JSX.Element {
  const orgBranding = useOrgBranding();
  const orgLabel = orgBranding?.display_name?.trim() || "LiveEngage";

  return (
    <main className="le-page-bg flex min-h-full flex-col">
      <AppHeader brand={orgLabel} tagline={appTagline} maxWidth="2xl" />

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-slide-up">
          <div className="le-card-elevated p-8 md:p-10">
            <header className="mb-8 space-y-2">
              {orgBranding?.logo_url ? (
                <OrgBrandMark fallback="LiveEngage" className="mb-2" />
              ) : (
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                  {orgLabel}
                </p>
              )}
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
      </div>
    </main>
  );
}
