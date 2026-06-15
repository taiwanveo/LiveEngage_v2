/** 組織品牌：favicon、Logo；可選覆寫主題 accent 色。 */

import * as React from "react";

export interface PublicBranding {
  display_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  override_theme_colors: boolean;
}

let activeBranding: PublicBranding | null = null;

function hexToRgbTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r} ${g} ${b}`;
}

/** 清除寫入 document 的 accent 覆寫。 */
export function clearBrandingColorOverrides(): void {
  const vars = [
    "--le-accent",
    "--le-accent-fg",
    "--le-accent-muted",
    "--le-primary-50",
    "--le-primary-100",
    "--le-primary-500",
    "--le-primary-600",
    "--le-primary-700",
  ];
  for (const name of vars) {
    document.documentElement.style.removeProperty(name);
  }
}

function applyBrandingColorOverrides(primaryColor: string): void {
  const rgb = hexToRgbTriplet(primaryColor);
  if (!rgb) return;
  document.documentElement.style.setProperty("--le-accent", rgb);
  document.documentElement.style.setProperty("--le-primary-600", rgb);
}

/** 依目前 active branding 與 data-theme 同步 accent（切換主題時呼叫）。 */
export function syncBrandingThemeColors(): void {
  clearBrandingColorOverrides();
  if (activeBranding?.override_theme_colors && activeBranding.primary_color) {
    applyBrandingColorOverrides(activeBranding.primary_color);
  }
}

function setActiveOrgBranding(branding: PublicBranding | null): void {
  activeBranding = branding;
  syncBrandingThemeColors();
}

export function applyOrgBranding(branding: PublicBranding | null | undefined): void {
  if (!branding) return;

  if (branding.favicon_url) {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.favicon_url;
  }

  if (branding.display_name) {
    document.title = branding.display_name;
  }
}

const OrgBrandingContext = React.createContext<PublicBranding | null>(null);

export function OrgBrandingProvider({
  branding,
  children,
}: {
  branding: PublicBranding | null;
  children: React.ReactNode;
}): React.JSX.Element {
  React.useEffect(() => {
    setActiveOrgBranding(branding);
    applyOrgBranding(branding);
    return () => {
      setActiveOrgBranding(null);
    };
  }, [branding]);

  return (
    <OrgBrandingContext.Provider value={branding}>{children}</OrgBrandingContext.Provider>
  );
}

export function useOrgBranding(): PublicBranding | null {
  return React.useContext(OrgBrandingContext);
}

export function OrgBrandMark({
  fallback = "LiveEngage",
  className = "",
  href,
  linkTitle = "回到活動儀表板",
}: {
  fallback?: string;
  className?: string;
  /** 設定後 Logo 可點擊導覽（例如 Host 回到活動儀表板） */
  href?: string;
  linkTitle?: string;
}): React.JSX.Element {
  const branding = useOrgBranding();
  const name = branding?.display_name?.trim() || fallback;

  const inner =
    branding?.logo_url ? (
      <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
        <img
          src={branding.logo_url}
          alt={name}
          className="h-7 max-w-[140px] object-contain object-left"
        />
        <span className="sr-only">{name}</span>
      </span>
    ) : (
      <span className={className}>{name}</span>
    );

  if (href) {
    return (
      <a
        href={href}
        title={linkTitle}
        className="inline-block rounded-sm transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {inner}
      </a>
    );
  }

  return inner;
}
