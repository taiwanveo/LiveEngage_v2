/** 公開站點品牌 API（登入頁，無需 JWT）。 */

import { apiUrl } from "./apiBase";

export interface SiteBranding {
  display_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
}

export async function fetchSiteBranding(): Promise<SiteBranding> {
  const res = await fetch(apiUrl("/api/v1/branding/site"));
  if (!res.ok) {
    throw new Error("無法載入品牌設定");
  }
  return (await res.json()) as SiteBranding;
}
