/** Screen：依活動載入組織品牌並套用 favicon／主題色。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { OrgBrandingProvider } from "@liveengage/ui";
import { fetchBrandingBySession } from "../lib/brandingApi";

export function ScreenBrandingRoot({
  sessionId,
  children,
}: {
  sessionId: string | null;
  children: React.ReactNode;
}): React.JSX.Element {
  const brandingQuery = useQuery({
    queryKey: ["screen-org-branding", sessionId],
    queryFn: () => fetchBrandingBySession(sessionId!),
    enabled: Boolean(sessionId),
    staleTime: 60_000,
  });

  return (
    <OrgBrandingProvider branding={brandingQuery.data ?? null}>
      {children}
    </OrgBrandingProvider>
  );
}
