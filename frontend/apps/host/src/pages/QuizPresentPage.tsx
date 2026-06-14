/** Quiz 大螢幕投影（唯讀；當前子題 + 排行榜）。 */

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
import { getAccessToken } from "../lib/auth";
import { getQuizLeaderboard, listQuizQuestions, type QuizQuestion } from "../lib/sprint9Api";

interface Props {
  roomId: string;
  quizId: string;
}

const BACKUP_REFETCH_MS = 5_000;

export function QuizPresentPage({ roomId, quizId }: Props): React.JSX.Element {
  const queryClient = useQueryClient();

  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", quizId],
    queryFn: () => listQuizQuestions(quizId),
    refetchInterval: BACKUP_REFETCH_MS,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["quiz-leaderboard", quizId],
    queryFn: () => getQuizLeaderboard(quizId),
    refetchInterval: BACKUP_REFETCH_MS,
  });

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (!QUIZ_EVENT_TYPES.has(event.type)) return;
      if (
        event.type === QUIZ_QUESTION_STARTED ||
        event.type === QUIZ_LEADERBOARD_UPDATED
      ) {
        void queryClient.invalidateQueries({ queryKey: ["quiz-questions", quizId] });
        void queryClient.invalidateQueries({ queryKey: ["quiz-leaderboard", quizId] });
      }
    },
    [queryClient, quizId]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token: getAccessToken(),
    mode: "present",
    onEvent: handleWsEvent,
  });

  const activeQuestion = useMemo(
    () =>
      (questionsQuery.data ?? []).find(
        (q) => q.state === "active" || q.state === "revealed"
      ) ?? null,
    [questionsQuery.data]
  );

  const entries = leaderboardQuery.data?.entries ?? [];

  return (
    <div className="relative flex min-h-full flex-col bg-slate-950 text-slate-100">
      <div
        className="absolute right-4 top-4 z-10 flex items-center gap-1.5 opacity-40 transition-opacity hover:opacity-100"
        title={connected ? "WS 已連線（present mode）" : "WS 未連線"}
      >
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
        />
      </div>

      <div className="flex flex-1 flex-col gap-8 p-8 md:flex-row md:p-12 lg:p-16">
        <section className="flex min-h-0 flex-1 flex-col">
          {activeQuestion ? (
            <QuizQuestionPresent question={activeQuestion} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <p className="font-display text-3xl font-bold text-slate-300 md:text-4xl">
                快問快答
              </p>
              <p className="mt-4 text-lg text-slate-500">等待主持人出題…</p>
            </div>
          )}
        </section>

        <aside className="w-full shrink-0 md:w-80 lg:w-96">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="font-display text-lg font-semibold text-slate-200">排行榜</h2>
            {entries.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">尚無分數</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {entries.map((e) => (
                  <li
                    key={e.participant_id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate text-slate-200">
                      <span className="mr-2 font-mono text-sky-400">#{e.rank}</span>
                      {e.display_name ?? "匿名"}
                    </span>
                    <span className="shrink-0 font-semibold text-amber-300">
                      {e.total_score}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function QuizQuestionPresent({ question }: { question: QuizQuestion }): React.JSX.Element {
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
          const isCorrect = Boolean(opt.is_correct);
          const highlight = revealed && isCorrect;
          return (
            <li
              key={opt.id}
              className={`rounded-xl border px-6 py-5 text-xl font-medium md:text-2xl ${
                highlight
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                  : "border-slate-700 bg-slate-900/60 text-slate-200"
              }`}
            >
              <span className="mr-3 font-mono text-slate-500">
                {String.fromCharCode(65 + idx)}.
              </span>
              {opt.text}
            </li>
          );
        })}
      </ul>
      {revealed && question.explanation ? (
        <p className="mt-8 text-lg text-slate-400">
          <span className="font-medium text-slate-300">解析：</span>
          {question.explanation}
        </p>
      ) : null}
    </div>
  );
}
