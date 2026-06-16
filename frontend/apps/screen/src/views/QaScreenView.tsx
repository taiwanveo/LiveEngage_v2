/** Q&A 投影視圖。 */

import * as React from "react";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QA_EVENT_TYPES, useRoomWebSocket, type WsEvent } from "@liveengage/realtime";
import { PRESENT_PAGE_TITLE_CLASS } from "@liveengage/ui";
import { getScreenToken } from "../lib/screenAuth";
import { listPublicQuestions } from "../lib/qaApi";
import type { QuestionPublic } from "../types";

interface Props {
  roomId: string;
}

const BACKUP_MS = 10_000;

export function QaScreenView({ roomId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const token = getScreenToken();

  const questionsQuery = useQuery({
    queryKey: ["qa-screen", roomId],
    queryFn: () => listPublicQuestions(roomId, "top"),
    refetchInterval: BACKUP_MS,
  });

  const handleWs = useCallback(
    (event: WsEvent) => {
      if (!QA_EVENT_TYPES.has(event.type)) return;
      void qc.invalidateQueries({ queryKey: ["qa-screen", roomId] });
    },
    [qc, roomId]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token,
    mode: "screen",
    onEvent: handleWs,
  });

  const items = questionsQuery.data ?? [];

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <div className="absolute right-4 top-4 z-10 opacity-40" title={connected ? "WS 已連線" : "WS 未連線"}>
        <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
      </div>
      <header className="border-b border-slate-800 px-8 py-4 md:px-12">
        <h1 className={PRESENT_PAGE_TITLE_CLASS}>Q&amp;A</h1>
        <p className="mt-2 text-sm text-slate-400">熱門問題 · {items.length} 則</p>
      </header>
      <div className="flex-1 overflow-y-auto px-8 py-8 md:px-12 md:py-10">
        {questionsQuery.isLoading ? (
          <p className="text-center text-slate-400">載入中…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-xl text-slate-500">尚無已核准問題</p>
        ) : (
          <ul className="mx-auto max-w-5xl space-y-6">
            {items.map((q, index) => (
              <QaCard key={q.id} question={q} rank={index + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QaCard({ question, rank }: { question: QuestionPublic; rank: number }): React.JSX.Element {
  const publicReplies = (question.replies ?? []).filter((r) => !r.is_private);
  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/20 font-display text-lg font-bold text-sky-300">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap font-display text-2xl font-semibold leading-snug text-white md:text-3xl">
            {question.content}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span>{question.is_anonymous ? "匿名" : (question.author_display ?? "—")}</span>
            <span>👍 {question.upvote_count}</span>
          </div>
          {publicReplies.length > 0 ? (
            <div className="mt-4 space-y-2 border-l-2 border-sky-500/40 pl-4">
              {publicReplies.map((r) => (
                <p key={r.id} className="text-base text-slate-300 md:text-lg">
                  <span className="font-medium text-sky-300">主持人：</span>
                  {r.content}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
