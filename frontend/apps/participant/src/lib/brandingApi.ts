/** 組織品牌 API（公開，依活動代碼）。 */

import { api } from "./api";
import type { PublicBranding } from "@liveengage/ui";

export function fetchBrandingByCode(code: string): Promise<PublicBranding> {
  return api<PublicBranding>(`/api/v1/branding/by-code/${encodeURIComponent(code)}`);
}
