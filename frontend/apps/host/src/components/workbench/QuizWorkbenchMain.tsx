/** Quiz 工作台中欄：子題控場與排行榜。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import {
  Button,
  ListActionDanger,
  ListActionLink,
  ListActionPrimary,
  useSystemNotice,
} from "@liveengage/ui";
import { canEditHostContent } from "../../lib/auth";
import {
  addQuizQuestion,
  deleteQuizQuestion,
  getQuizLeaderboard,
  listQuizQuestions,
  quizAction,
  type QuizQuestion,
} from "../../lib/sprint9Api";
import {
  interactionMetaLine,
  interactionTypeLabel,
  quizQuestionStateLabel,
  type InteractionSummary,
} from "../../lib/pollTypes";
import { Sprint9ActivateBanner } from "./Sprint9ActivateBanner";

interface Props {
  roomId: string;
  item: InteractionSummary;
}

const QUIZ_ACTION_SUCCESS: Record<"start_question" | "reveal" | "close", string> = {
  start_question: "子題已開始",
  reveal: "已揭曉答案",
  close: "子題已結束",
};

export function QuizWorkbenchMain({ roomId, item }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [quizTitle, setQuizTitle] = useState("");
  const { showError, showSuccess } = useSystemNotice();
  const editable = canEditHostContent();
  const interactionId = item.id;

  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", interactionId],
    queryFn: () => listQuizQuestions(interactionId),
    refetchInterval: 5_000,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["quiz-leaderboard", interactionId],
    queryFn: () => getQuizLeaderboard(interactionId),
    refetchInterval: 5_000,
  });

  const addQuestionMutation = useMutation({
    mutationFn: () =>
      addQuizQuestion(interactionId, {
        title: quizTitle.trim() || "新題目",
        options: [
          { text: "A", is_correct: true, order_no: 0 },
          { text: "B", is_correct: false, order_no: 1 },
        ],
      }),
    onSuccess: () => {
      setQuizTitle("");
      showSuccess("子題已新增");
      void qc.invalidateQueries({ queryKey: ["quiz-questions", interactionId] });
    },
    onError: (err: unknown) => showError(formatUserFacingError(err)),
  });

  const actionMutation = useMutation({
    mutationFn: ({
      questionId,
      action,
    }: {
      questionId: string;
      action: "start_question" | "reveal" | "close";
    }) => quizAction(questionId, action),
    onSuccess: (data, variables) => {
      qc.setQueryData<QuizQuestion[]>(
        ["quiz-questions", interactionId],
        (old) =>
          old?.map((q) =>
            q.id === variables.questionId ? { ...q, state: data.state } : q
          ) ?? old
      );
      showSuccess(QUIZ_ACTION_SUCCESS[variables.action]);
      void qc.invalidateQueries({ queryKey: ["quiz-leaderboard", interactionId] });
    },
    onError: (err: unknown) => showError(formatUserFacingError(err)),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: deleteQuizQuestion,
    onSuccess: () => {
      showSuccess("子題已刪除");
      void qc.invalidateQueries({ queryKey: ["quiz-questions", interactionId] });
    },
    onError: (err: unknown) => showError(formatUserFacingError(err)),
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted">{interactionTypeLabel(item.type)}</p>
        <h2 className="font-display text-xl font-semibold text-foreground">
          {item.title ?? "未命名 Quiz"}
        </h2>
        <p className="mt-1 text-sm text-muted">{interactionMetaLine(item.type, item.status)}</p>
      </div>

      <Sprint9ActivateBanner roomId={roomId} item={item} />

      {editable ? (
        <section className="le-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">新增子題</h3>
          <div className="flex gap-2">
            <input
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="題目文字"
              className="le-input flex-1"
            />
            <button
              type="button"
              disabled={addQuestionMutation.isPending}
              onClick={() => addQuestionMutation.mutate()}
              className="le-btn-primary le-btn-sm"
            >
              新增
            </button>
          </div>
        </section>
      ) : null}

      <section className="le-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">子題控場</h3>
        <ul className="space-y-3">
          {(questionsQuery.data ?? []).map((q) => {
            const canStart = q.state === "pending";
            const canReveal = q.state === "active";
            const canClose = q.state === "active" || q.state === "revealed";
            const busy = actionMutation.isPending;

            return (
              <li
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2"
              >
                <div>
                  <p className="font-medium text-foreground">{q.title}</p>
                  <p className="text-xs text-muted">狀態：{quizQuestionStateLabel(q.state)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {editable && q.state === "pending" ? (
                    <ListActionLink
                      href={`#/rooms/${roomId}/sprint9/${interactionId}/questions/${q.id}/edit`}
                    >
                      編輯
                    </ListActionLink>
                  ) : null}
                  <ListActionPrimary
                    disabled={!canStart || busy}
                    onClick={() =>
                      actionMutation.mutate({ questionId: q.id, action: "start_question" })
                    }
                  >
                    {busy && canStart ? "處理中…" : "開始"}
                  </ListActionPrimary>
                  <Button
                    variant="muted"
                    size="sm"
                    disabled={!canReveal || busy}
                    onClick={() =>
                      actionMutation.mutate({ questionId: q.id, action: "reveal" })
                    }
                  >
                    揭曉
                  </Button>
                  {canClose ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        actionMutation.mutate({ questionId: q.id, action: "close" })
                      }
                    >
                      結束
                    </Button>
                  ) : null}
                  {editable && q.state === "pending" ? (
                    <ListActionDanger
                      disabled={deleteQuestionMutation.isPending}
                      onClick={() => {
                        if (!window.confirm(`確定要刪除子題「${q.title}」？`)) return;
                        deleteQuestionMutation.mutate(q.id);
                      }}
                    >
                      刪除
                    </ListActionDanger>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="le-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">排行榜</h3>
        <ol className="list-decimal pl-5 text-sm">
          {(leaderboardQuery.data?.entries ?? []).map((e) => (
            <li key={e.participant_id}>
              #{e.rank} {e.display_name ?? "匿名"} — {e.total_score} 分
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** 供頂欄顯示的進行中子題摘要 */
export function useActiveQuizQuestionLabel(interactionId: string | null): string | null {
  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", interactionId],
    queryFn: () => listQuizQuestions(interactionId!),
    enabled: Boolean(interactionId),
    refetchInterval: 5_000,
  });
  const active = questionsQuery.data?.find((q) => q.state === "active");
  if (!active) return null;
  return `子題：${active.title ?? "進行中"}`;
}
