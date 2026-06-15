/** Sprint 9 現場控制台：Quiz 控場 / Ideas 列表 / Survey 結果。 */

import * as React from "react";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  QUIZ_EVENT_TYPES,
  formatUserFacingError,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import {
  Button,
  ListActionDanger,
  ListActionLink,
  ListActionPrimary,
  useSystemNotice,
} from "@liveengage/ui";
import { HostRoomDetailBreadcrumb } from "../components/HostBreadcrumb";
import { HostShell } from "../components/HostShell";
import { HostTitleLink } from "../components/HostTitleActions";
import { sprint9PresentUrl } from "../lib/presentUrl";
import { getAccessToken } from "../lib/auth";
import { listInteractions } from "../lib/interactionApi";
import {
  addQuizQuestion,
  deleteQuizQuestion,
  getQuizLeaderboard,
  getSurveyResults,
  hideIdea,
  listIdeas,
  listQuizQuestions,
  quizAction,
  addSurveyQuestion,
  type QuizQuestion,
} from "../lib/sprint9Api";
import { interactionTypeLabel, quizQuestionStateLabel } from "../lib/pollTypes";

interface Props {
  roomId: string;
  interactionId: string;
  onLogout: () => void;
}

const QUIZ_ACTION_SUCCESS: Record<
  "start_question" | "reveal" | "close",
  string
> = {
  start_question: "子題已開始",
  reveal: "已揭曉答案",
  close: "子題已結束",
};

export function Sprint9ConsolePage({
  roomId,
  interactionId,
  onLogout,
}: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [quizTitle, setQuizTitle] = useState("");
  const { showError, showSuccess, systemNoticeModal } = useSystemNotice();

  const metaQuery = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });
  const item = metaQuery.data?.find((i) => i.id === interactionId);

  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", interactionId],
    queryFn: () => listQuizQuestions(interactionId),
    enabled: item?.type === "quiz",
    refetchInterval: item?.type === "quiz" ? 5_000 : false,
  });

  const refreshQuizData = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["quiz-questions", interactionId] }),
      qc.invalidateQueries({ queryKey: ["quiz-leaderboard", interactionId] }),
    ]);
  }, [qc, interactionId]);

  const handleQuizWsEvent = useCallback(
    (event: WsEvent) => {
      if (!QUIZ_EVENT_TYPES.has(event.type)) return;
      void refreshQuizData();
    },
    [refreshQuizData]
  );

  useRoomWebSocket({
    roomId,
    token: getAccessToken(),
    mode: "host",
    onEvent: handleQuizWsEvent,
    enabled: item?.type === "quiz",
  });

  const leaderboardQuery = useQuery({
    queryKey: ["quiz-leaderboard", interactionId],
    queryFn: () => getQuizLeaderboard(interactionId),
    enabled: item?.type === "quiz",
    refetchInterval: 5_000,
  });

  const ideasQuery = useQuery({
    queryKey: ["ideas", interactionId],
    queryFn: () => listIdeas(interactionId),
    enabled: item?.type === "ideas",
    refetchInterval: 4_000,
  });

  const surveyResultsQuery = useQuery({
    queryKey: ["survey-results", interactionId],
    queryFn: () => getSurveyResults(interactionId),
    enabled: item?.type === "survey",
    refetchInterval: 8_000,
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
      void refreshQuizData();
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

  const hideMutation = useMutation({
    mutationFn: hideIdea,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ideas", interactionId] }),
    onError: (err: unknown) => showError(formatUserFacingError(err)),
  });

  const addSurveyQMutation = useMutation({
    mutationFn: () =>
      addSurveyQuestion(interactionId, {
        title: "滿意度（1–5）",
        question_type: "rating",
        required: true,
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["survey-results", interactionId] }),
    onError: (err: unknown) => showError(formatUserFacingError(err)),
  });

  const backToList = (
    <HostTitleLink href={`#/rooms/${roomId}/sprint9`} variant="secondary">
      返回列表
    </HostTitleLink>
  );

  const interactionTitle = item?.title?.trim() || interactionTypeLabel(item?.type ?? "quiz");

  const consoleBreadcrumb = (
    <HostRoomDetailBreadcrumb
      roomId={roomId}
      sectionLabel="Quiz 管理"
      sectionSegment="sprint9"
      segments={[
        {
          label: metaQuery.isLoading ? "載入中…" : interactionTitle,
        },
        { label: "控制台" },
      ]}
    />
  );

  if (!item) {
    return (
      <HostShell
        title="控制台"
        {...(metaQuery.isLoading ? { subtitle: "載入中…" } : {})}
        roomId={roomId}
        onLogout={onLogout}
        activeNav="sprint9"
        breadcrumb={consoleBreadcrumb}
        titleAddon={backToList}
      >
        <p className="text-sm text-muted">載入中…</p>
      </HostShell>
    );
  }

  return (
    <HostShell
      title={`${item.title ?? interactionTypeLabel(item.type)} 控制台`}
      subtitle={interactionTypeLabel(item.type)}
      roomId={roomId}
      onLogout={onLogout}
      activeNav="sprint9"
      breadcrumb={consoleBreadcrumb}
      titleAddon={backToList}
      {...(["quiz", "ideas", "survey"].includes(item.type)
        ? { presentHref: sprint9PresentUrl(roomId, interactionId) }
        : {})}
    >
      {item.type === "quiz" ? (
        <div className="space-y-6">
          {item.status !== "active" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              此 Quiz 尚未開放。請先到{" "}
              <a href={`#/rooms/${roomId}/sprint9`} className="font-medium underline">
                Quiz 管理列表
              </a>{" "}
              點「開放」，參與者才能作答；主機仍可在下方控場。
            </p>
          ) : null}
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
          <section className="le-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">子題控場</h3>
            <ul className="space-y-3">
              {(questionsQuery.data ?? []).map((q) => {
                const canStart = q.state === "pending";
                const canReveal = q.state === "active";
                const canClose = q.state === "active" || q.state === "revealed";
                const busy = actionMutation.isPending;

                return (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div>
                    <p className="font-medium text-foreground">{q.title}</p>
                    <p className="text-xs text-muted">
                      狀態：{quizQuestionStateLabel(q.state)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {q.state === "pending" ? (
                      <ListActionLink
                        href={`#/rooms/${roomId}/sprint9/${interactionId}/questions/${q.id}/edit`}
                      >
                        編輯
                      </ListActionLink>
                    ) : null}
                    <ListActionPrimary
                      disabled={!canStart || busy}
                      title={canStart ? "開始此子題" : "僅「待開始」狀態可開始"}
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
                      title={canReveal ? "揭曉正確答案" : "須先「開始」後才能揭曉"}
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
                    {q.state === "pending" ? (
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
      ) : null}

      {item.type === "ideas" ? (
        <section className="le-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">點子列表</h3>
          <ul className="space-y-3">
            {(ideasQuery.data?.items ?? []).map((idea) => (
              <li key={idea.id} className="rounded-lg border border-border bg-surface-elevated p-3">
                <p className="text-foreground">{idea.content}</p>
                <p className="mt-1 text-xs text-muted">
                  {idea.author_display ?? "匿名"} · 👍 {idea.reaction_total}
                </p>
                <button
                  type="button"
                  onClick={() => hideMutation.mutate(idea.id)}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  隱藏
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.type === "survey" ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => addSurveyQMutation.mutate()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white"
          >
            新增評分題
          </button>
          <section className="le-card p-4">
            <p className="text-sm text-foreground">
              提交數：{surveyResultsQuery.data?.submission_count ?? 0}
            </p>
          </section>
        </div>
      ) : null}
      {systemNoticeModal}
    </HostShell>
  );
}
