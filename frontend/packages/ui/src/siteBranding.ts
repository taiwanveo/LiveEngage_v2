/** 站點品牌顯示（Admin / Host / Participant 登入與加入頁共用）。 */

import type { PublicBranding } from "./orgBranding";

/** 未設定 Logo 時使用的預設 LiveEngage 圖示（各 app 的 public/）。 */
export const DEFAULT_LIVEENGAGE_LOGO = "/liveengage-logo.png";

/** 未設定組織名稱時的完整產品標題。 */
export const DEFAULT_PRODUCT_TITLE = "LiveEngage 即時互動通";

/** 登入／加入表單輸入框（淺藍 pill 造型）。 */
export const AUTH_INPUT_CLASS =
  "le-input border-sky-100 bg-sky-50/90 focus:border-sky-300 focus:ring-2 focus:ring-sky-200/60 dark:border-sky-900/50 dark:bg-sky-950/25 dark:focus:border-sky-700";

/** 依後台品牌／組織名稱組出產品標題（suffix 固定為「即時互動通」）。 */
export function formatProductTitle(displayName: string | null | undefined): string {
  const prefix = displayName?.trim();
  if (!prefix) return DEFAULT_PRODUCT_TITLE;
  if (prefix.includes("即時互動通")) return prefix;
  return `${prefix} 即時互動通`;
}

export function resolveBrandedLogoUrl(logoUrl: string | null | undefined): string {
  return logoUrl?.trim() || DEFAULT_LIVEENGAGE_LOGO;
}

export function brandedProductTitle(branding: PublicBranding | null | undefined): string {
  return formatProductTitle(branding?.display_name);
}

export function brandedLogoUrl(branding: PublicBranding | null | undefined): string {
  return resolveBrandedLogoUrl(branding?.logo_url);
}
