/** Admin App 入口；hash router（S7-1 骨架）。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { getAccessToken, clearAccessToken } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import {
  OrganizationPage,
  SessionsPage,
  AuditPage,
  BrandingPage,
  ExportsPage,
} from "./pages/AdminPages";
import type { AdminRoute } from "./lib/nav";

type Route = { name: AdminRoute } | { name: "login" };

function parseHash(): Route {
  const segment = window.location.hash.replace(/^#\/?/, "").split("/")[0];

  switch (segment) {
    case "dashboard":
    case "":
      return { name: "dashboard" };
    case "organization":
      return { name: "organization" };
    case "sessions":
      return { name: "sessions" };
    case "audit":
      return { name: "audit" };
    case "branding":
      return { name: "branding" };
    case "exports":
      return { name: "exports" };
    default:
      return { name: "login" };
  }
}

export function App(): React.JSX.Element {
  const [route, setRoute] = useState<Route>(parseHash());
  const [authed, setAuthed] = useState<boolean>(Boolean(getAccessToken()));

  useEffect(() => {
    const onHashChange = (): void => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const logout = (): void => {
    clearAccessToken();
    setAuthed(false);
    window.location.hash = "";
  };

  if (!authed) {
    return (
      <LoginPage
        onLoggedIn={() => {
          setAuthed(true);
          window.location.hash = "#/dashboard";
        }}
      />
    );
  }

  switch (route.name) {
    case "organization":
      return <OrganizationPage onLogout={logout} />;
    case "sessions":
      return <SessionsPage onLogout={logout} />;
    case "audit":
      return <AuditPage onLogout={logout} />;
    case "branding":
      return <BrandingPage onLogout={logout} />;
    case "exports":
      return <ExportsPage onLogout={logout} />;
    case "dashboard":
    default:
      return <DashboardPage onLogout={logout} />;
  }
}
