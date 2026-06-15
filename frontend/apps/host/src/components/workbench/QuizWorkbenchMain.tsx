/** Quiz 工作台中欄：子題控場與排行榜。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import {
  Button,
  ButtonLink,
  ListActionDanger,
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
  interactionTypeLabel,
  quizQuestionStateLabel,
  type InteractionSummary,
} from "../../lib/pollTypes";
import { WorkbenchInteractionStatusBadge } from "./WorkbenchInteractionStatusBadge";
import { WorkbenchInteractionTitle } from "./WorkbenchInteractionTitle";
import { WORKBENCH_S9_EDIT_ID } from "./WorkbenchInteractionActions";

interface Props {
  roomId: string;
  item: InteractionSummary;
}

const QUIZ_ACTION_SUCCESS: Record<
  "start_question" | "reveal" | "hide" | "close",
  string
> = {
  start_question: "子題已開始",
  reveal: "已揭曉答案",
  hide: "已隱藏答案",
  close: "子題已結束",
};

export function QuizWorkbenchMain({ roomId, item }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [quizTitle, setQuizTitle] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    questionId: string;
    action: "start_question" | "reveal" | "hide" | "close";
  } | null>(null);
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
      action: "start_question" | "reveal" | "hide" | "close";
    }) => quizAction(questionId, action),
    onMutate: (variables) => {
      setPendingAction({ questionId: variables.questionId, action: variables.action });
    },
    onSuccess: (data, variables) => {
      qc.setQueryData<QuizQuestion[]>(
        ["quiz-questions", interactionId],
        (old) =>
          old?.map((q) =>
            q.id === variables.questionId
              ? {
                  ...q,
                  state: data.state,
                  result_visible: data.result_visible,
                }
              : q
          ) ?? old
      );
      showSuccess(QUIZ_ACTION_SUCCESS[variables.action]);
      void qc.invalidateQueries({ queryKey: ["quiz-questions", interactionId] });
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
      void qc.invalidateQueries({ queryKey: ["quiz-leaderboard", interactionId] });
    },
    onError: (err: unknown) => showError(formatUserFacingError(err)),
    onSettled: () => setPendingAction(null),
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">{interactionTypeLabel(item.type)}</p>
          <WorkbenchInteractionTitle
            roomId={roomId}
            interactionId={item.id}
            title={item.title}
            placeholder="未命名 Quiz"
          />
        </div>
        <WorkbenchInteractionStatusBadge status={item.status} />
      </div>

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

      <section id={WORKBENCH_S9_EDIT_ID} className="le-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">子題控場</h3>
        <ul className="space-y-3">
          {(questionsQuery.data ?? []).map((q) => {
            const isRunning = q.state === "active" || q.state === "revealed";
            const canStart = q.state === "pending" || q.state === "closed";
            const canEnd = isRunning;
            const resultVisible = Boolean(q.result_visible);
            const canReveal =
              q.state === "active" ||
              (q.state === "revealed" && !resultVisible);
            const canHide = q.state === "revealed" && resultVisible;
            const rowBusy =
              pendingAction?.questionId === q.id && actionMutation.isPending;
            const editHref = `#/rooms/${roomId}/sprint9/${interactionId}/questions/${q.id}/edit`;

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
                  {editable ? (
                    <ButtonLink
                      variant="muted"
                      size="sm"
                      href={editHref}
                      title="編輯子題"
                    >
                      編輯
                    </ButtonLink>
                  ) : null}
                  {canEnd ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={rowBusy}
                      onClick={() =>
                        actionMutation.mutate({ questionId: q.id, action: "close" })
                      }
                    >
                      {rowBusy && pendingAction?.action === "close"
                        ? "處理中…"
                        : "結束"}
                    </Button>
                  ) : (
                    <ListActionPrimary
                      disabled={!canStart || rowBusy}
                      onClick={() =>
                        actionMutation.mutate({ questionId: q.id, action: "start_question" })
                      }
                    >
                      {rowBusy && pendingAction?.action === "start_question"
                        ? "處理中…"
                        : "開始"}
                    </ListActionPrimary>
                  )}
                  <Button
                    variant="muted"
                    size="sm"
                    disabled={(!canReveal && !canHide) || rowBusy}
                    onClick={() =>
                      actionMutation.mutate({
                        questionId: q.id,
                        action: canHide ? "hide" : "reveal",
                      })
                    }
                  >
                    {rowBusy &&
                    (pendingAction?.action === "reveal" ||
                      pendingAction?.action === "hide")
                      ? "處理中…"
                      : canHide
                        ? "隱藏"
                        : "揭曉"}
                  </Button>
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
