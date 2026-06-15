/** 組織品牌：favicon、主色、頂欄 Logo（S7-4）。 */

import * as React from "react";

export interface PublicBranding {
  display_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
}

function hexToRgbTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r} ${g} ${b}`;
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

  const rgb = hexToRgbTriplet(branding.primary_color);
  if (rgb) {
    document.documentElement.style.setProperty("--le-accent", rgb);
    document.documentElement.style.setProperty("--le-primary-600", rgb);
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
    applyOrgBranding(branding);
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
}: {
  fallback?: string;
  className?: string;
}): React.JSX.Element {
  const branding = useOrgBranding();
  const name = branding?.display_name?.trim() || fallback;

  if (branding?.logo_url) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
        <img
          src={branding.logo_url}
          alt={name}
          className="h-7 max-w-[140px] object-contain object-left"
        />
        <span className="sr-only">{name}</span>
      </span>
    );
  }

  return <span className={className}>{name}</span>;
}
