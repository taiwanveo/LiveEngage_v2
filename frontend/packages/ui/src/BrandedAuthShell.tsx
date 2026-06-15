/** 登入／加入頁共用外殼：頂欄 + 組織名稱／Logo + 標題區 + 表單內容。 */

import * as React from "react";
import { AppHeader } from "./AppHeader";
import { OrgBrandingProvider } from "./orgBranding";
import type { PublicBranding } from "./orgBranding";
import { brandedLogoUrl, brandedProductTitleLines } from "./siteBranding";

interface Props {
  /** AppHeader 副標，例如「控場端（host）」 */
  appTagline: string;
  title: string;
  subtitle?: string;
  branding: PublicBranding | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 頂欄左側平台品牌，預設 LiveEngage */
  headerBrand?: string;
}

export function BrandedAuthShell({
  appTagline,
  title,
  subtitle,
  branding,
  children,
  footer,
  headerBrand = "LiveEngage",
}: Props): React.JSX.Element {
  const { primary, suffix } = brandedProductTitleLines(branding);
  const logoSrc = brandedLogoUrl(branding);

  return (
    <OrgBrandingProvider branding={branding}>
      <main className="le-page-bg flex min-h-full flex-col">
        <AppHeader brand={headerBrand} tagline={appTagline} maxWidth="2xl" />

        <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-md animate-slide-up">
            <div className="le-card-elevated p-8 md:p-10">
              <div className="mb-8 flex items-start justify-between gap-4 border-b border-border/60 pb-6">
                <p className="min-w-0 font-display text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">
                  <span className="block">{primary}</span>
                  <span className="block">{suffix}</span>
                </p>
                <img
                  src={logoSrc}
                  alt=""
                  className="h-10 w-auto max-w-[140px] shrink-0 object-contain object-right"
                />
              </div>

              <header className="mb-8 space-y-2">
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
    </OrgBrandingProvider>
  );
}
