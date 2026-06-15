/** Admin 已登入區塊：載入組織品牌並套用 favicon／主題色覆寫。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { OrgBrandingProvider } from "@liveengage/ui";
import { fetchOrgBrandingMe } from "../lib/brandingApi";

export function AdminBrandingRoot({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const brandingQuery = useQuery({
    queryKey: ["admin-org-branding"],
    queryFn: fetchOrgBrandingMe,
  });

  return (
    <OrgBrandingProvider branding={brandingQuery.data ?? null}>
      {children}
    </OrgBrandingProvider>
  );
}
