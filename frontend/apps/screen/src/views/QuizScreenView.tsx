/** Quiz 投影視圖。 */

import * as React from "react";
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POLL_RESULT_HIDDEN,
  POLL_RESULT_REVEALED,
  POLL_STOPPED,
  QUIZ_LEADERBOARD_UPDATED,
  QUIZ_QUESTION_CLOSED,
  QUIZ_QUESTION_STARTED,
  QUIZ_QUESTION_UPDATED,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PRESENT_PAGE_TITLE_CLASS } from "@liveengage/ui";
import { getScreenToken } from "../lib/screenAuth";
import {
  getQuizLeaderboard,
  listQuizQuestions,
  type LeaderboardEntry,
  type QuizQuestion,
} from "../lib/sprint9Api";
import type { ScreenSubView } from "../lib/screenApi";

interface Props {
  roomId: string;
  quizId: string;
  subView: ScreenSubView;
}

const BACKUP_MS = 2_000;

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
      // 1. Quiz 題目更新 / 題目開始（0ms 即時同步畫面）
      if (
        event.type === QUIZ_QUESTION_STARTED ||
        event.type === QUIZ_QUESTION_UPDATED
      ) {
        const q = event.payload.question as QuizQuestion | undefined;
        if (q) {
          qc.setQueryData<QuizQuestion[]>(["quiz-questions", quizId], (old) => {
            if (!old) return [q];
            const exists = old.some((item) => item.id === q.id);
            if (event.type === QUIZ_QUESTION_STARTED) {
              const updated = old.map((item) =>
                item.id === q.id
                  ? { ...item, ...q }
                  : item.state === "active"
                  ? { ...item, state: "closed" }
                  : item
              );
              return exists ? updated : [...updated, q];
            }
            // QUIZ_QUESTION_UPDATED
            if (exists) {
              return old.map((item) => (item.id === q.id ? { ...item, ...q } : item));
            }
            return [...old, q];
          });
        }
        void qc.invalidateQueries({ queryKey: ["quiz-questions", quizId] });
        return;
      }

      // 2. Quiz 題目關閉
      if (event.type === QUIZ_QUESTION_CLOSED) {
        const qId = event.payload.question_id as string | undefined;
        if (qId) {
          qc.setQueryData<QuizQuestion[]>(["quiz-questions", quizId], (old) => {
            if (!old) return old;
            return old.map((item) =>
              item.id === qId ? { ...item, state: "closed" } : item
            );
          });
        }
        void qc.invalidateQueries({ queryKey: ["quiz-questions", quizId] });
        return;
      }

      // 3. 排行榜即時更新
      if (event.type === QUIZ_LEADERBOARD_UPDATED) {
        const entries = event.payload.entries as LeaderboardEntry[] | undefined;
        if (entries) {
          qc.setQueryData(["quiz-leaderboard", quizId], { entries });
        }
        void qc.invalidateQueries({ queryKey: ["quiz-leaderboard", quizId] });
        return;
      }

      // 4. 正解揭曉
      if (event.type === POLL_RESULT_REVEALED) {
        const pollId = event.payload.poll_id as string | undefined;
        const correctOptionIds =
          (event.payload.correct_option_ids as string[] | undefined) ?? [];
        if (pollId) {
          qc.setQueryData<QuizQuestion[]>(["quiz-questions", quizId], (old) => {
            if (!old) return old;
            return old.map((item) => {
              if (item.child_interaction_id === pollId || item.id === pollId) {
                return {
                  ...item,
                  state: "revealed",
                  result_visible: true,
                  options: item.options.map((opt) => ({
                    ...opt,
                    is_correct: correctOptionIds.includes(opt.id),
                  })),
                };
              }
              return item;
            });
          });
        }
        void qc.invalidateQueries({ queryKey: ["quiz-questions", quizId] });
        return;
      }

      // 5. 隱藏正解
      if (event.type === POLL_RESULT_HIDDEN) {
        const pollId = event.payload.poll_id as string | undefined;
        if (pollId) {
          qc.setQueryData<QuizQuestion[]>(["quiz-questions", quizId], (old) => {
            if (!old) return old;
            return old.map((item) => {
              if (item.child_interaction_id === pollId || item.id === pollId) {
                return { ...item, result_visible: false };
              }
              return item;
            });
          });
        }
        void qc.invalidateQueries({ queryKey: ["quiz-questions", quizId] });
        return;
      }

      // 6. 子題目結束
      if (event.type === POLL_STOPPED) {
        const pollId = event.payload.poll_id as string | undefined;
        if (pollId) {
          qc.setQueryData<QuizQuestion[]>(["quiz-questions", quizId], (old) => {
            if (!old) return old;
            return old.map((item) => {
              if (item.child_interaction_id === pollId || item.id === pollId) {
                return { ...item, state: "closed" };
              }
              return item;
            });
          });
        }
        void qc.invalidateQueries({ queryKey: ["quiz-questions", quizId] });
        return;
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
  const showQuestion = subView === "question" || subView === "results";
  const showLeaderboard = subView === "leaderboard" || subView === "results";
  const leaderboardOnly = showLeaderboard && !showQuestion;

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <div className="absolute right-4 top-4 z-10 opacity-90" title={connected ? "WS 已連線" : "WS 未連線"}>
        <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
      </div>
      <div className="flex flex-1 flex-col gap-8 p-8 md:flex-row md:p-12 lg:p-16">
        {showQuestion ? (
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
        {showLeaderboard && (
          <aside className={`w-full shrink-0 ${leaderboardOnly ? "flex-1" : "md:w-80 lg:w-96"}`}>
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
