/** Sprint 9 投影路由：依互動 type 切換 Quiz / Ideas / Survey 投影頁。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { listInteractions } from "../lib/interactionApi";
import { interactionTypeLabel } from "../lib/pollTypes";
import { IdeasPresentPage } from "./IdeasPresentPage";
import { QuizPresentPage } from "./QuizPresentPage";
import { SurveyPresentPage } from "./SurveyPresentPage";

interface Props {
  roomId: string;
  interactionId: string;
}

export function Sprint9PresentRouter({
  roomId,
  interactionId,
}: Props): React.JSX.Element {
  const metaQuery = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });

  const item = metaQuery.data?.find((i) => i.id === interactionId);

  if (metaQuery.isLoading || !item) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-950 text-slate-400">
        載入中…
      </div>
    );
  }

  if (item.type === "quiz") {
    return <QuizPresentPage roomId={roomId} quizId={interactionId} />;
  }

  if (item.type === "ideas") {
    return <IdeasPresentPage roomId={roomId} boardId={interactionId} />;
  }

  if (item.type === "survey") {
    return (
      <SurveyPresentPage surveyId={interactionId} title={item.title} />
    );
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-slate-950 px-8 text-center text-slate-300">
      <p className="text-xl">
        「{interactionTypeLabel(item.type)}」尚不支援投影
      </p>
    </div>
  );
}
