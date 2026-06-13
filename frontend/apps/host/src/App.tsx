/** Host App 入口；hash router。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { ModerationPage } from "./pages/ModerationPage";
import { PollAnswerPage } from "./pages/PollAnswerPage";
import { PollBuilderPage } from "./pages/PollBuilderPage";
import { PollConsolePage } from "./pages/PollConsolePage";
import { PollHubPage } from "./pages/PollHubPage";
import { PollRenderersDemoPage } from "./pages/PollRenderersDemoPage";
import { PresentPage } from "./pages/PresentPage";
import { getAccessToken, clearAccessToken } from "./lib/auth";

type Route =
  | { name: "login" }
  | { name: "moderation"; roomId: string }
  | { name: "poll-renderers-demo" }
  | { name: "polls"; roomId: string }
  | { name: "poll-builder"; roomId: string; pollId: string }
  | { name: "poll-console"; roomId: string; pollId: string }
  | { name: "poll-answer"; roomId: string; pollId: string }
  | { name: "poll-present"; roomId: string; pollId: string };

function parseHash(): Route {
  const parts = window.location.hash.replace(/^#/, "").split("/").filter(Boolean);

  if (parts[0] === "poll-renderers-demo") {
    return { name: "poll-renderers-demo" };
  }

  if (parts[0] === "rooms" && parts[1]) {
    const roomId = parts[1];
    if (parts[2] === "moderation") {
      return { name: "moderation", roomId };
    }
    if (parts[2] === "polls") {
      if (parts[3] && parts[4] === "builder") {
        return { name: "poll-builder", roomId, pollId: parts[3] };
      }
      if (parts[3] && parts[4] === "console") {
        return { name: "poll-console", roomId, pollId: parts[3] };
      }
      if (parts[3] && parts[4] === "answer") {
        return { name: "poll-answer", roomId, pollId: parts[3] };
      }
      if (parts[3] && parts[4] === "present") {
        return { name: "poll-present", roomId, pollId: parts[3] };
      }
      return { name: "polls", roomId };
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

  const logout = (): void => {
    clearAccessToken();
    setAuthed(false);
    window.location.hash = "";
  };

  if (route.name === "poll-renderers-demo") {
    return (
      <PollRenderersDemoPage
        onBack={() => {
          window.location.hash = authed ? "#/rooms/_/moderation" : "";
        }}
      />
    );
  }

  if (route.name === "poll-present" && authed) {
    return <PresentPage roomId={route.roomId} pollId={route.pollId} />;
  }

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

  switch (route.name) {
    case "polls":
      return <PollHubPage roomId={route.roomId} onLogout={logout} />;
    case "poll-builder":
      return (
        <PollBuilderPage
          roomId={route.roomId}
          pollId={route.pollId}
          onLogout={logout}
        />
      );
    case "poll-console":
      return (
        <PollConsolePage
          roomId={route.roomId}
          pollId={route.pollId}
          onLogout={logout}
        />
      );
    case "poll-answer":
      return (
        <PollAnswerPage
          roomId={route.roomId}
          pollId={route.pollId}
          onLogout={logout}
        />
      );
    case "moderation":
    default:
      return <ModerationPage roomId={route.roomId} onLogout={logout} />;
  }
}
