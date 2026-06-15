/** 工作台中欄：依互動類型切換控場 UI。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { getPoll, getPollResults } from "../../lib/pollApi";
import { isPollType, type InteractionSummary } from "../../lib/pollTypes";
import { POLL_RESULTS_BACKUP_REFETCH_MS } from "../../lib/pollActionCache";
import { PollWorkbenchMain } from "./PollWorkbenchMain";
import { QuizWorkbenchMain } from "./QuizWorkbenchMain";
import { IdeasWorkbenchMain } from "./IdeasWorkbenchMain";
import { SurveyWorkbenchMain } from "./SurveyWorkbenchMain";
import { WorkbenchPollPreview } from "./previews/WorkbenchPollPreview";
import { WorkbenchQuizPreview } from "./previews/WorkbenchQuizPreview";
import { WorkbenchIdeasPreview } from "./previews/WorkbenchIdeasPreview";
import { WorkbenchSurveyPreview } from "./previews/WorkbenchSurveyPreview";

interface Props {
  roomId: string;
  item: InteractionSummary | null;
}

function EmptyMain({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-surface p-8 text-sm text-muted">
      {message}
    </div>
  );
}

export function WorkbenchMainPanel({ roomId, item }: Props): React.JSX.Element {
  const pollQuery = useQuery({
    queryKey: ["poll", item?.id],
    queryFn: () => getPoll(item!.id),
    enabled: Boolean(item && isPollType(item.type)),
    refetchInterval: POLL_RESULTS_BACKUP_REFETCH_MS,
  });

  const resultsQuery = useQuery({
    queryKey: ["poll-results", item?.id],
    queryFn: () => getPollResults(item!.id),
    enabled: Boolean(item && isPollType(item.type)),
    refetchInterval: POLL_RESULTS_BACKUP_REFETCH_MS,
  });

  if (!item) {
    return <EmptyMain message="請從左側建立或選擇一個互動項目。" />;
  }

  if (isPollType(item.type)) {
    if (pollQuery.isLoading) return <EmptyMain message="載入 Poll…" />;
    const poll = pollQuery.data;
    if (!poll) return <EmptyMain message="無法載入 Poll。" />;
    return (
      <div className="space-y-4">
        <PollWorkbenchMain roomId={roomId} poll={poll} results={resultsQuery.data ?? null} />
      </div>
    );
  }

  if (item.type === "quiz") {
    return <QuizWorkbenchMain roomId={roomId} item={item} />;
  }

  if (item.type === "ideas") {
    return <IdeasWorkbenchMain roomId={roomId} item={item} />;
  }

  if (item.type === "survey") {
    return <SurveyWorkbenchMain roomId={roomId} item={item} />;
  }

  return <EmptyMain message="不支援的互動類型。" />;
}

export function WorkbenchPreviewPanel({
  item,
}: {
  item: InteractionSummary | null;
}): React.JSX.Element {
  if (!item) {
    return (
      <p className="text-center text-xs text-muted">選擇互動以預覽參與者畫面</p>
    );
  }

  if (isPollType(item.type)) {
    return <WorkbenchPollPreviewLoader item={item} />;
  }

  if (item.type === "quiz") {
    return <WorkbenchQuizPreview item={item} />;
  }

  if (item.type === "ideas") {
    return <WorkbenchIdeasPreview item={item} />;
  }

  if (item.type === "survey") {
    return <WorkbenchSurveyPreview item={item} />;
  }

  return <p className="text-center text-xs text-muted">無法預覽此類型</p>;
}

function WorkbenchPollPreviewLoader({
  item,
}: {
  item: InteractionSummary;
}): React.JSX.Element {
  const pollQuery = useQuery({
    queryKey: ["poll", item.id],
    queryFn: () => getPoll(item.id),
    refetchInterval: POLL_RESULTS_BACKUP_REFETCH_MS,
  });

  const resultsQuery = useQuery({
    queryKey: ["poll-results", item.id],
    queryFn: () => getPollResults(item.id),
    refetchInterval: POLL_RESULTS_BACKUP_REFETCH_MS,
  });

  if (pollQuery.isLoading || !pollQuery.data) {
    return <p className="text-center text-xs text-muted">載入預覽…</p>;
  }

  return (
    <WorkbenchPollPreview poll={pollQuery.data} results={resultsQuery.data ?? null} />
  );
}
