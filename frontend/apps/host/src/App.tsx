/** Host App 入口；極簡 router：以 hash 切換 login / moderation。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { ModerationPage } from "./pages/ModerationPage";
import { getAccessToken, clearAccessToken } from "./lib/auth";

type Route = { name: "login" } | { name: "moderation"; roomId: string };

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#/, "");
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "rooms" && parts[1] && parts[2] === "moderation") {
    return { name: "moderation", roomId: parts[1] };
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

  if (!authed || route.name === "login") {
    return (
      <LoginPage
        onLoggedIn={() => {
          setAuthed(true);
          if (route.name === "login") {
            window.location.hash = "#/rooms/_/moderation";
          }
        }}
      />
    );
  }

  return (
    <ModerationPage
      roomId={route.roomId}
      onLogout={() => {
        clearAccessToken();
        setAuthed(false);
        window.location.hash = "";
      }}
    />
  );
}
