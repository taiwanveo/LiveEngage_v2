/** Admin App 入口；hash router（S7-1 骨架）。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { hasValidSession, clearAccessToken } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { OrganizationPage } from "./pages/OrganizationPage";
import { AccountsPage } from "./pages/AccountsPage";
import { SessionsPage } from "./pages/SessionsPage";
import { AuditPage } from "./pages/AuditPage";
import { ExportsPage } from "./pages/ExportsPage";
import { SsoCallbackPage, parseSsoCallbackHash } from "./pages/SsoCallbackPage";
import { AdminBrandingRoot } from "./components/AdminBrandingRoot";
import type { AdminRoute } from "./lib/nav";

type Route = { name: AdminRoute } | { name: "login" };

function parseHash(): Route {
  const segment = window.location.hash.replace(/^#\/?/, "").split("/")[0];

  switch (segment) {
    case "dashboard":
    case "":
      return { name: "dashboard" };
    case "organization":
    case "branding":
      return { name: "organization" };
    case "accounts":
      return { name: "accounts" };
    case "sessions":
      return { name: "sessions" };
    case "audit":
      return { name: "audit" };
    case "exports":
      return { name: "exports" };
    default:
      return { name: "login" };
  }
}

export function App(): React.JSX.Element {
  const [route, setRoute] = useState<Route>(parseHash());
  const [authed, setAuthed] = useState<boolean>(hasValidSession());

  useEffect(() => {
    const onHashChange = (): void => {
      const seg = window.location.hash.replace(/^#\/?/, "").split("/")[0];
      if (seg === "branding") {
        window.location.replace("#/organization");
        return;
      }
      setRoute(parseHash());
    };
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const logout = (): void => {
    clearAccessToken();
    setAuthed(false);
    window.location.hash = "";
  };

  const ssoCallback = parseSsoCallbackHash();
  if (ssoCallback) {
    return (
      <SsoCallbackPage
        ticket={ssoCallback.ticket}
        returnTo={ssoCallback.returnTo}
        onLoggedIn={() => setAuthed(true)}
      />
    );
  }

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

  const page = (() => {
    switch (route.name) {
      case "organization":
        return <OrganizationPage onLogout={logout} />;
      case "accounts":
        return <AccountsPage onLogout={logout} />;
      case "sessions":
        return <SessionsPage onLogout={logout} />;
      case "audit":
        return <AuditPage onLogout={logout} />;
      case "exports":
        return <ExportsPage onLogout={logout} />;
      case "dashboard":
      default:
        return <DashboardPage onLogout={logout} />;
    }
  })();

  return <AdminBrandingRoot>{page}</AdminBrandingRoot>;
}
