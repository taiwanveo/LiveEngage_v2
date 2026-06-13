/** Participant App 入口；hash router。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { CodeEntryPage } from "./pages/CodeEntryPage";
import { JoinPage } from "./pages/JoinPage";
import { RoomPage } from "./pages/RoomPage";
import { getParticipantContext } from "./lib/participantAuth";

type Route =
  | { name: "code-entry" }
  | { name: "join"; code: string }
  | { name: "room" };

function parseHash(): Route {
  const parts = window.location.hash.replace(/^#/, "").split("/").filter(Boolean);

  if (parts[0] === "room") {
    return { name: "room" };
  }

  if (parts[0] === "join") {
    if (parts[1]) {
      return { name: "join", code: parts[1].toUpperCase() };
    }
    return { name: "code-entry" };
  }

  const ctx = getParticipantContext();
  if (ctx) {
    return { name: "room" };
  }

  return { name: "code-entry" };
}

export function App(): React.JSX.Element {
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    const onHashChange = (): void => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  switch (route.name) {
    case "join":
      return <JoinPage code={route.code} />;
    case "room":
      return <RoomPage />;
    case "code-entry":
    default:
      return <CodeEntryPage />;
  }
}
