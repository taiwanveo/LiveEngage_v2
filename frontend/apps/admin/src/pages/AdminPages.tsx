import * as React from "react";
import { AdminShell } from "../components/AdminShell";
import { PlaceholderPage } from "../components/PlaceholderPage";
import { NAV_ITEMS } from "../lib/nav";

interface Props {
  onLogout: () => void;
}

function makePage(routeId: (typeof NAV_ITEMS)[number]["id"]) {
  const item = NAV_ITEMS.find((i) => i.id === routeId);
  if (!item) throw new Error(`未知路由：${routeId}`);

  return function Page({ onLogout }: Props): React.JSX.Element {
    return (
      <AdminShell active={routeId} onLogout={onLogout}>
        <PlaceholderPage item={item} />
      </AdminShell>
    );
  };
}

export const OrganizationPage = makePage("organization");
export const SessionsPage = makePage("sessions");
export const AuditPage = makePage("audit");
export const AccountsPage = makePage("accounts");
export const ExportsPage = makePage("exports");
