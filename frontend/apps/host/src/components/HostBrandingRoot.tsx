/** Host 已登入區塊：載入組織品牌並套用至頂欄／favicon。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { OrgBrandingProvider } from "@liveengage/ui";
import { fetchOrgBrandingMe } from "../lib/brandingApi";

export function HostBrandingRoot({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const brandingQuery = useQuery({
    queryKey: ["host-org-branding"],
    queryFn: fetchOrgBrandingMe,
  });

  return (
    <OrgBrandingProvider branding={brandingQuery.data ?? null}>
      {children}
    </OrgBrandingProvider>
  );
}
