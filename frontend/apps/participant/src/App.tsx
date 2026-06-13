/** Participant App 入口；hash router。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CodeEntryPage } from "./pages/CodeEntryPage";
import { JoinPage } from "./pages/JoinPage";
import { RoomPage } from "./pages/RoomPage";
import { parseParticipantSsoCallback, SsoCallbackPage } from "./pages/SsoCallbackPage";
import { getParticipantContext } from "./lib/participantAuth";
import { resolveSessionByCode } from "./lib/sessionApi";

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

  const sso = parseParticipantSsoCallback();
  if (sso) {
    const parts = sso.returnTo.replace(/^join\//, "").split("/");
    const code = parts[0]?.toUpperCase() ?? "";
    return (
      <SsoCallbackLoader ticket={sso.ticket} returnTo={sso.returnTo} code={code} />
    );
  }

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

function SsoCallbackLoader(props: {
  ticket: string;
  returnTo: string;
  code: string;
}): React.JSX.Element {
  const q = useQuery({
    queryKey: ["session-by-code", props.code],
    queryFn: () => resolveSessionByCode(props.code),
    enabled: Boolean(props.code),
  });
  if (!props.code || q.isLoading) {
    return (
      <main className="le-page-bg flex min-h-full items-center justify-center">
        <p className="text-muted">載入中…</p>
      </main>
    );
  }
  if (!q.data) {
    return (
      <main className="le-page-bg flex min-h-full items-center justify-center">
        <p className="text-danger">找不到活動</p>
      </main>
    );
  }
  return (
    <SsoCallbackPage
      ticket={props.ticket}
      sessionId={q.data.id}
      sessionCode={props.code}
    />
  );
}
