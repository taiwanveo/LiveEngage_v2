/** 依 display state 切換投影視圖。 */

import * as React from "react";
import type { ScreenDisplayState } from "../lib/screenApi";
import { IdeasScreenView } from "./IdeasScreenView";
import { OverviewScreenView } from "./OverviewScreenView";
import { PollScreenView } from "./PollScreenView";
import { QaScreenView } from "./QaScreenView";
import { QuizScreenView } from "./QuizScreenView";
import { StandbyView } from "./StandbyView";
import { SurveyScreenView } from "./SurveyScreenView";
import { TestView } from "./TestView";

interface Props {
  roomId: string;
  sessionId: string;
  state: ScreenDisplayState | undefined;
  connected: boolean;
  isLoading: boolean;
}

export function ScreenRouter({
  roomId,
  sessionId,
  state,
  connected,
  isLoading,
}: Props): React.JSX.Element {
  if (isLoading && !state) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">
        載入投影狀態…
      </main>
    );
  }

  const view = state?.view ?? "standby";
  const interactionId = state?.interaction_id ?? null;
  const subView = state?.sub_view ?? "question";
  const sessionTitle = state?.session_title ?? null;

  switch (view) {
    case "test":
      return <TestView />;
    case "overview":
      return (
        <OverviewScreenView
          roomId={roomId}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
        />
      );
    case "poll":
      if (interactionId) {
        return (
          <PollScreenView roomId={roomId} pollId={interactionId} subView={subView} />
        );
      }
      break;
    case "qa":
      return <QaScreenView roomId={roomId} />;
    case "quiz":
      if (interactionId) {
        return (
          <QuizScreenView
            roomId={roomId}
            quizId={interactionId}
            subView={subView}
          />
        );
      }
      break;
    case "ideas":
      if (interactionId) {
        return <IdeasScreenView roomId={roomId} boardId={interactionId} />;
      }
      break;
    case "survey":
      if (interactionId) {
        return (
          <SurveyScreenView surveyId={interactionId} title={sessionTitle} />
        );
      }
      break;
    case "standby":
    default:
      return (
        <StandbyView
          sessionTitle={sessionTitle}
          connected={connected}
          updatedAt={state?.updated_at ?? null}
        />
      );
  }

  return (
    <StandbyView
      sessionTitle={sessionTitle}
      connected={connected}
      updatedAt={state?.updated_at ?? null}
    />
  );
}
