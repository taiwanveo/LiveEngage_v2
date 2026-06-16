/** Quiz 投影視圖。 */

import * as React from "react";
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  QUIZ_EVENT_TYPES,
  QUIZ_LEADERBOARD_UPDATED,
  QUIZ_QUESTION_STARTED,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PRESENT_PAGE_TITLE_CLASS } from "@liveengage/ui";
import { getScreenToken } from "../lib/screenAuth";
import {
  getQuizLeaderboard,
  listQuizQuestions,
  type QuizQuestion,
} from "../lib/sprint9Api";
import type { ScreenSubView } from "../lib/screenApi";

interface Props {
  roomId: string;
  quizId: string;
  subView: ScreenSubView;
}

const BACKUP_MS = 5_000;

export function QuizScreenView({ roomId, quizId, subView }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const token = getScreenToken();

  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", quizId],
    queryFn: () => listQuizQuestions(quizId),
    refetchInterval: BACKUP_MS,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["quiz-leaderboard", quizId],
    queryFn: () => getQuizLeaderboard(quizId),
    refetchInterval: BACKUP_MS,
    enabled: subView !== "question",
  });

  const handleWs = useCallback(
    (event: WsEvent) => {
      if (!QUIZ_EVENT_TYPES.has(event.type)) return;
      if (
        event.type === QUIZ_QUESTION_STARTED ||
        event.type === QUIZ_LEADERBOARD_UPDATED
      ) {
        void qc.invalidateQueries({ queryKey: ["quiz-questions", quizId] });
        void qc.invalidateQueries({ queryKey: ["quiz-leaderboard", quizId] });
      }
    },
    [qc, quizId]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token,
    mode: "screen",
    onEvent: handleWs,
  });

  const activeQuestion = useMemo(
    () =>
      (questionsQuery.data ?? []).find(
        (q) => q.state === "active" || q.state === "revealed"
      ) ?? null,
    [questionsQuery.data]
  );

  const entries = leaderboardQuery.data?.entries ?? [];
  const showLeaderboard = subView === "leaderboard";

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <div className="absolute right-4 top-4 z-10 opacity-90" title={connected ? "WS 已連線" : "WS 未連線"}>
        <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
      </div>
      <div className="flex flex-1 flex-col gap-8 p-8 md:flex-row md:p-12 lg:p-16">
        {!showLeaderboard ? (
          <section className="flex min-h-0 flex-1 flex-col">
            {activeQuestion ? (
              <QuizQuestionBlock question={activeQuestion} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <p className={`${PRESENT_PAGE_TITLE_CLASS} text-slate-300`}>快問快答</p>
                <p className="mt-4 text-lg text-slate-500">等待主持人出題…</p>
              </div>
            )}
          </section>
        ) : null}
        {(showLeaderboard || entries.length > 0) && (
          <aside className={`w-full shrink-0 ${showLeaderboard ? "flex-1" : "md:w-80 lg:w-96"}`}>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
              <h2 className="font-display text-lg font-semibold text-slate-200">排行榜</h2>
              {entries.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">尚無分數</p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {entries.map((e) => (
                    <li key={e.participant_id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-slate-200">
                        <span className="mr-2 font-mono text-sky-400">#{e.rank}</span>
                        {e.display_name ?? "匿名"}
                      </span>
                      <span className="shrink-0 font-semibold text-amber-300">{e.total_score}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function QuizQuestionBlock({ question }: { question: QuizQuestion }): React.JSX.Element {
  const revealed = question.state === "revealed";
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-sm font-medium uppercase tracking-widest text-sky-400">
        {revealed ? "正解揭曉" : "進行中"}
      </p>
      <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
        {question.title ?? "題目"}
      </h1>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {question.options.map((opt, idx) => {
          const highlight = revealed && Boolean(opt.is_correct);
          return (
            <li
              key={opt.id}
              className={`rounded-xl border px-6 py-5 text-xl font-medium md:text-2xl ${
                highlight
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                  : "border-slate-700 bg-slate-900/60 text-slate-200"
              }`}
            >
              <span className="mr-3 font-mono text-slate-500">{String.fromCharCode(65 + idx)}.</span>
              {opt.text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
