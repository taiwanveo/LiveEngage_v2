/** Sprint 7 佔位頁。 */

import * as React from "react";
import { AdminPageHeader, AdminPanel } from "../components/AdminLayout";
import type { NavItem } from "../lib/nav";

interface Props {
  item: NavItem;
}

export function PlaceholderPage({ item }: Props): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl">
      <AdminPageHeader title={item.label} description={item.description} />

      <AdminPanel className="mt-6 border-dashed p-8 text-center">
        <p className="text-sm text-muted">此功能尚未完成，將於後續版本提供。</p>
      </AdminPanel>
    </div>
  );
}
