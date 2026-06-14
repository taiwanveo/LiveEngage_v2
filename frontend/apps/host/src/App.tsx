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
import { SessionsDashboardPage } from "./pages/SessionsDashboardPage";
import { SsoCallbackPage, parseSsoCallbackHash } from "./pages/SsoCallbackPage";
import { SessionWorkbenchPage } from "./pages/SessionWorkbenchPage";
import { QuizQuestionEditPage } from "./pages/QuizQuestionEditPage";
import { Sprint9ConsolePage } from "./pages/Sprint9ConsolePage";
import { Sprint9HubPage } from "./pages/Sprint9HubPage";
import { hasValidSession, clearAccessToken } from "./lib/auth";

type Route =
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "moderation"; roomId: string }
  | { name: "poll-renderers-demo" }
  | { name: "polls"; roomId: string }
  | { name: "poll-builder"; roomId: string; pollId: string }
  | { name: "poll-console"; roomId: string; pollId: string }
  | { name: "poll-answer"; roomId: string; pollId: string }
  | { name: "poll-present"; roomId: string; pollId: string }
  | { name: "sprint9"; roomId: string }
  | { name: "workbench"; roomId: string; pollId?: string | undefined }
  | { name: "sprint9-console"; roomId: string; interactionId: string }
  | { name: "quiz-edit"; roomId: string; quizId: string; questionId: string };

function parseHash(): Route {
  const parts = window.location.hash.replace(/^#/, "").split("/").filter(Boolean);

  if (parts.length === 0 || parts[0] === "dashboard") {
    return { name: "dashboard" };
  }

  if (parts[0] === "poll-renderers-demo") {
    return { name: "poll-renderers-demo" };
  }

  if (parts[0] === "rooms" && parts[1]) {
    const roomId = parts[1];
    if (parts[2] === "workbench") {
      return { name: "workbench", roomId, pollId: parts[3] };
    }
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
    if (parts[2] === "sprint9") {
      if (parts[3] && parts[4] === "questions" && parts[5] && parts[6] === "edit") {
        return {
          name: "quiz-edit",
          roomId,
          quizId: parts[3],
          questionId: parts[5],
        };
      }
      if (parts[3] && parts[4] === "console") {
        return { name: "sprint9-console", roomId, interactionId: parts[3] };
      }
      return { name: "sprint9", roomId };
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

  if (route.name === "poll-renderers-demo") {
    return (
      <PollRenderersDemoPage
        onBack={() => {
          window.location.hash = authed ? "#/dashboard" : "";
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
          window.location.hash = "#/dashboard";
        }}
      />
    );
  }

  switch (route.name) {
    case "dashboard":
      return <SessionsDashboardPage onLogout={logout} />;
    case "workbench":
      return (
        <SessionWorkbenchPage
          roomId={route.roomId}
          pollId={route.pollId}
          onLogout={logout}
        />
      );
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
      return <ModerationPage roomId={route.roomId} onLogout={logout} />;
    case "sprint9":
      return <Sprint9HubPage roomId={route.roomId} onLogout={logout} />;
    case "sprint9-console":
      return (
        <Sprint9ConsolePage
          roomId={route.roomId}
          interactionId={route.interactionId}
          onLogout={logout}
        />
      );
    case "quiz-edit":
      return (
        <QuizQuestionEditPage
          roomId={route.roomId}
          quizId={route.quizId}
          questionId={route.questionId}
          onLogout={logout}
        />
      );
    default:
      return <SessionsDashboardPage onLogout={logout} />;
  }
}
