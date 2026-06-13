/** Present App 入口；hash router。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { getAccessToken } from "./lib/auth";
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
  const [authed, setAuthed] = useState<boolean>(Boolean(getAccessToken()));

  useEffect(() => {
    const onHashChange = (): void => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route.name === "poll-present" && authed) {
    return <PollPresentPage roomId={route.roomId} pollId={route.pollId} />;
  }

  if (!authed || route.name === "login") {
    return (
      <LoginPage
        onLoggedIn={() => {
          setAuthed(true);
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
