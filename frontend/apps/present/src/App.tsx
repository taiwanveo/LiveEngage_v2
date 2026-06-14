/** Present App 入口；hash router。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { hasValidSession, setAuthTokens } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";
import { PollPresentPage } from "./pages/PollPresentPage";
import { PresentSessionPicker } from "./pages/PresentSessionPicker";

type Route =
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "poll-present"; roomId: string; pollId: string };

function parseHash(): Route {
  const parts = window.location.hash.replace(/^#/, "").split("/").filter(Boolean);

  if (parts.length === 0 || parts[0] === "dashboard") {
    return { name: "dashboard" };
  }

  if (parts[0] === "rooms" && parts[1] && parts[2] === "polls" && parts[3]) {
    const roomId = parts[1];
    const pollId = parts[3];
    if (parts[4] === "present" || !parts[4]) {
      return { name: "poll-present", roomId, pollId };
    }
  }

  return { name: "login" };
}

export function App(): React.JSX.Element {
  const [route, setRoute] = useState<Route>(parseHash());
  const [authed, setAuthed] = useState<boolean>(hasValidSession());

  useEffect(() => {
    const onHashChange = (): void => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const onMessage = (ev: MessageEvent): void => {
      const data = ev.data as {
        type?: string;
        access_token?: string;
        refresh_token?: string;
      } | null;
      if (data?.type !== "LE_PRESENT_AUTH") return;
      if (!data.access_token || !data.refresh_token) return;
      setAuthTokens(data.access_token, data.refresh_token);
      setAuthed(true);
    };
    window.addEventListener("message", onMessage);
    if (window.opener) {
      window.opener.postMessage({ type: "LE_PRESENT_AUTH_READY" }, "*");
    }
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (route.name === "poll-present" && authed) {
    return <PollPresentPage roomId={route.roomId} pollId={route.pollId} />;
  }

  if (!authed || route.name === "login") {
    return (
      <LoginPage
        onLoggedIn={() => {
          setAuthed(true);
          if (route.name === "poll-present") return;
          window.location.hash = "#/dashboard";
        }}
      />
    );
  }

  return (
    <PresentSessionPicker
      onLogout={() => {
        setAuthed(false);
        window.location.hash = "";
      }}
    />
  );
}
