/** 組織品牌 API（已登入 Host）。 */

import { api } from "./api";
import type { PublicBranding } from "@liveengage/ui";

export function fetchOrgBrandingMe(): Promise<PublicBranding> {
  return api<PublicBranding>("/api/v1/branding/me");
}
