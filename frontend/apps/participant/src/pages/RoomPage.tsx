/** 參與者房間：顯示 active Poll 並作答（P-3 E2E）+ WS 即時推送（P-4/P-WS-1）。 */

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POLL_RESULT_HIDDEN,
  POLL_RESULT_REVEALED,
  POLL_RESPONSE_SUBMITTED,
  POLL_STARTED,
  POLL_STOPPED,
  POLL_LOCKED,
  POLL_UNLOCKED,
  QA_EVENT_TYPES,
  QUIZ_QUESTION_STARTED,
  SESSION_ENDED,
  IDEAS_EVENT_TYPES,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PollRenderer } from "@liveengage/renderers";
import { RoomIdeasPanel } from "../components/RoomIdeasPanel";
import { ParticipantShareActions } from "../components/ParticipantShareActions";
import { RoomQaPanel } from "../components/RoomQaPanel";
import { ApiException } from "../lib/api";
import {
  clearParticipantSession,
  getParticipantContext,
} from "../lib/participantAuth";
import { getPoll, getPollResults, isPollType, submitPollResponse } from "../lib/pollApi";
import { getSessionState } from "../lib/sessionApi";
import { submitQuizAnswer, type ActiveQuizQuestion } from "../lib/sprint9Api";
import { AppHeader, Modal } from "@liveengage/ui";

export function RoomPage(): React.JSX.Element {
  const ctx = getParticipantContext();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"poll" | "qa" | "ideas" | "quiz">("poll");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pollSubmitOk, setPollSubmitOk] = useState(false);
  const [quizSubmitOk, setQuizSubmitOk] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState<ActiveQuizQuestion | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endedTitle, setEndedTitle] = useState("活動");

  // session-state：30s 安全備援；WS 事件觸發 invalidate
  const stateQuery = useQuery({
    queryKey: ["session-state", ctx?.sessionId],
    queryFn: () => getSessionState(ctx!.sessionId),
    enabled: Boolean(ctx?.sessionId),
    refetchInterval: 30_000,
  });

  const activePollId = useMemo(() => {
    if (!ctx || !stateQuery.data) return null;
    const hit = stateQuery.data.active_interactions.find(
      (i) =>
        i.room_id === ctx.roomId &&
        isPollType(i.type) &&
        i.status === "active"
    );
    return hit?.id ?? null;
  }, [ctx, stateQuery.data]);

  const activeIdeasBoardId = useMemo(() => {
    if (!ctx || !stateQuery.data) return null;
    const hit = stateQuery.data.active_interactions.find(
      (i) => i.room_id === ctx.roomId && i.type === "ideas" && i.status === "active"
    );
    return hit?.id ?? null;
  }, [ctx, stateQuery.data]);

  const pollQuery = useQuery({
    queryKey: ["poll", activePollId],
    queryFn: () => getPoll(activePollId!),
    enabled: Boolean(activePollId),
    refetchInterval: 30_000,
  });

  const resultsQuery = useQuery({
    queryKey: ["poll-results", activePollId],
    queryFn: () => getPollResults(activePollId!),
    enabled: Boolean(activePollId && pollQuery.data?.result_visible),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    setPollSubmitOk(false);
    setSubmitError(null);
    if (activePollId) {
      void queryClient.removeQueries({ queryKey: ["poll-results", activePollId] });
    }
  }, [activePollId, queryClient]);

  useEffect(() => {
    if (stateQuery.data?.status === "ended") {
      setEndedTitle(stateQuery.data.title ?? "活動");
      setSessionEnded(true);
    }
  }, [stateQuery.data?.status, stateQuery.data?.title]);

  // WS 事件處理：依事件類型決定 invalidate 策略
  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (QA_EVENT_TYPES.has(event.type)) {
        void queryClient.invalidateQueries({ queryKey: ["qa-public", ctx?.roomId] });
      }
      switch (event.type) {
        case POLL_STARTED: {
          setTab("poll");
          setPollSubmitOk(false);
          setSubmitError(null);
          const startedPollId =
            typeof event.payload.poll_id === "string" ? event.payload.poll_id : activePollId;
          if (startedPollId) {
            void queryClient.removeQueries({ queryKey: ["poll-results", startedPollId] });
          }
          void queryClient.invalidateQueries({
            queryKey: ["session-state", ctx?.sessionId],
          });
          if (activePollId) {
            void queryClient.invalidateQueries({ queryKey: ["poll", activePollId] });
          }
          break;
        }
        case POLL_STOPPED:
          void queryClient.invalidateQueries({
            queryKey: ["session-state", ctx?.sessionId],
          });
          if (activePollId) {
            void queryClient.invalidateQueries({ queryKey: ["poll", activePollId] });
          }
          break;
        case POLL_LOCKED:
        case POLL_UNLOCKED:
          if (activePollId) {
            void queryClient.invalidateQueries({ queryKey: ["poll", activePollId] });
          }
          break;
        case POLL_RESULT_REVEALED:
        case POLL_RESULT_HIDDEN:
          if (activePollId) {
            void queryClient.invalidateQueries({ queryKey: ["poll", activePollId] });
            void queryClient.invalidateQueries({
              queryKey: ["poll-results", activePollId],
            });
          }
          break;
        case POLL_RESPONSE_SUBMITTED:
          if (activePollId) {
            void queryClient.invalidateQueries({
              queryKey: ["poll-results", activePollId],
            });
          }
          break;
        case QUIZ_QUESTION_STARTED: {
          const q = event.payload.question as ActiveQuizQuestion | undefined;
          if (q) {
            setQuizQuestion(q);
            setTab("quiz");
          }
          break;
        }
        case SESSION_ENDED: {
          const title =
            typeof event.payload.title === "string" ? event.payload.title : "活動";
          setEndedTitle(title);
          setSessionEnded(true);
          break;
        }
        default:
          if (IDEAS_EVENT_TYPES.has(event.type) && activeIdeasBoardId) {
            void queryClient.invalidateQueries({
              queryKey: ["ideas-board", activeIdeasBoardId],
            });
          }
          break;
      }
    },
    [queryClient, ctx?.sessionId, activePollId, activeIdeasBoardId],
  );

  const { connected } = useRoomWebSocket({
    roomId: ctx?.roomId ?? null,
    token: ctx?.participantToken ?? null,
    mode: "participant",
    enabled: Boolean(ctx),
    onEvent: handleWsEvent,
  });

  const submitMutation = useMutation({
    mutationFn: (answer: Record<string, unknown>) =>
      submitPollResponse(activePollId!, answer),
    onSuccess: () => {
      setSubmitError(null);
      setPollSubmitOk(true);
      void pollQuery.refetch();
      if (pollQuery.data?.result_visible) {
        void resultsQuery.refetch();
      }
    },
    onError: (err: unknown) => {
      setPollSubmitOk(false);
      if (err instanceof ApiException) {
        setSubmitError(err.error.message);
      } else {
        setSubmitError((err as Error).message);
      }
    },
  });

  if (!ctx) {
    return (
      <main className="flex min-h-full items-center justify-center px-4">
        <div className="text-center">
          <p className="text-muted">請先加入活動</p>
          <a href="#/join" className="mt-4 inline-block text-primary-600 hover:underline">
            輸入活動代碼
          </a>
        </div>
      </main>
    );
  }

  const sessionTitle = stateQuery.data?.title ?? "活動";
  const sessionCode = ctx.sessionCode ?? stateQuery.data?.code ?? null;
  const poll = pollQuery.data;

  const leave = (): void => {
    clearParticipantSession();
    const code = ctx.sessionCode;
    window.location.hash = code ? `#/join/${code}` : "#/join";
  };

  const leaveAfterSessionEnded = (): void => {
    setSessionEnded(false);
    leave();
  };

  return (
    <main className="le-page-bg min-h-full">
      <AppHeader
        brand={sessionTitle}
        tagline={ctx.displayName ? `你好，${ctx.displayName}` : "參與者（participant）"}
        maxWidth="2xl"
        logoutLabel="離開"
        onLogout={leave}
        chromeFooterActions={<ParticipantShareActions sessionCode={sessionCode} />}
        actions={
          <span
            className={connected ? "le-status-dot-live" : "le-status-dot bg-muted"}
            title={connected ? "即時連線中" : "連線中斷，備援輪詢"}
          />
        }
      />

      <div className="mx-auto max-w-2xl border-b border-border bg-surface/60 px-4 backdrop-blur-sm">
        <nav className="flex gap-1 overflow-x-auto" aria-label="互動分頁">
          <TabButton active={tab === "poll"} onClick={() => setTab("poll")} live={Boolean(activePollId)}>
            投票（Poll）
          </TabButton>
          <TabButton active={tab === "qa"} onClick={() => setTab("qa")}>
            問答（Q&amp;A）
          </TabButton>
          {activeIdeasBoardId ? (
            <TabButton active={tab === "ideas"} onClick={() => setTab("ideas")}>
              點子牆（Ideas）
            </TabButton>
          ) : null}
          {quizQuestion ? (
            <TabButton active={tab === "quiz"} onClick={() => setTab("quiz")} live>
              Quiz
            </TabButton>
          ) : null}
        </nav>
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-6">
        {tab === "qa" ? (
          <RoomQaPanel roomId={ctx.roomId} />
        ) : tab === "ideas" && activeIdeasBoardId ? (
          <RoomIdeasPanel boardId={activeIdeasBoardId} />
        ) : tab === "quiz" && quizQuestion ? (
          <div className="le-card p-6">
            <h2 className="font-display text-lg font-semibold text-foreground">{quizQuestion.title}</h2>
            <ul className="mt-4 space-y-2">
              {quizQuestion.options.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    disabled={quizSubmitting}
                    onClick={() => {
                      setQuizSubmitting(true);
                      setSubmitError(null);
                      void submitQuizAnswer(quizQuestion.id, [opt.id])
                        .then(() => {
                          setQuizSubmitOk(true);
                          setSubmitError(null);
                        })
                        .catch((err: unknown) => {
                          setQuizSubmitOk(false);
                          setSubmitError(
                            err instanceof ApiException ? err.error.message : "提交失敗"
                          );
                        })
                        .finally(() => setQuizSubmitting(false));
                    }}
                    className="le-btn-secondary w-full !justify-start disabled:opacity-50"
                  >
                    {opt.text}
                  </button>
                </li>
              ))}
            </ul>
            <Modal
              open={quizSubmitOk}
              onClose={() => setQuizSubmitOk(false)}
              title="提交成功"
              size="sm"
            >
              <p className="text-sm text-muted">Quiz 已提交，感謝參與！</p>
            </Modal>
            {submitError ? (
              <p className="mt-3 text-sm text-danger">{submitError}</p>
            ) : null}
          </div>
        ) : (
          <>
        <Modal
          open={pollSubmitOk}
          onClose={() => setPollSubmitOk(false)}
          title="提交成功"
          size="sm"
        >
          <p className="text-sm text-muted">已提交，感謝參與！</p>
        </Modal>

        {stateQuery.isLoading ? (
          <p className="text-center text-sm text-muted">載入活動狀態…</p>
        ) : !activePollId ? (
          <div className="le-card border-dashed p-10 text-center">
            <p className="text-lg font-medium text-foreground">等待投票開始</p>
            <p className="mt-2 text-sm text-muted">
              主持人啟動 Poll 後，題目會自動出現在此頁
            </p>
          </div>
        ) : pollQuery.error ? (
          <p className="text-sm text-danger">
            {(pollQuery.error as Error).message}
          </p>
        ) : poll ? (
          <PollRenderer
            mode="answer"
            poll={poll}
            results={poll.result_visible ? resultsQuery.data ?? null : null}
            onSubmit={(answer) => {
              setPollSubmitOk(false);
              submitMutation.mutate(answer);
            }}
            submitting={submitMutation.isPending}
            submitError={submitError}
          />
        ) : (
          <p className="text-center text-sm text-muted">載入題目…</p>
        )}
          </>
        )}
      </div>

      <Modal
        open={sessionEnded}
        onClose={leaveAfterSessionEnded}
        title="活動已結束"
        size="sm"
      >
        <p className="text-sm text-muted">
          「{endedTitle}」已由主持人結束，感謝您的參與！
        </p>
      </Modal>
    </main>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  live?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`relative shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
        props.active
          ? "border-accent text-accent"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {props.children}
      {props.live ? (
        <span className="le-status-dot-live absolute right-0 top-3" title="進行中" />
      ) : null}
    </button>
  );
}
