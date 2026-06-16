/** 組織品牌 API（公開，依活動 ID）。 */

import { api } from "./api";
import type { PublicBranding } from "@liveengage/ui";

export function fetchBrandingBySession(sessionId: string): Promise<PublicBranding> {
  return api<PublicBranding>(`/api/v1/branding/by-session/${sessionId}`, {
    public: true,
  });
}
