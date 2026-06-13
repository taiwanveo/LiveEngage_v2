/** 管理後台共用外殼：側欄導覽 + 主內容區。 */

import * as React from "react";
import { AdminSidebarShell } from "@liveengage/ui";
import { NAV_ITEMS, type AdminRoute } from "../lib/nav";

interface Props {
  active: AdminRoute;
  onLogout: () => void;
  children: React.ReactNode;
}

export function AdminShell({
  active,
  onLogout,
  children,
}: Props): React.JSX.Element {
  return (
    <AdminSidebarShell
      activeId={active}
      onLogout={onLogout}
      navItems={NAV_ITEMS.map((item) => ({
        id: item.id,
        href: item.hash,
        label: item.label,
      }))}
    >
      {children}
    </AdminSidebarShell>
  );
}
