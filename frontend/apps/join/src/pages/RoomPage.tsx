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
  QUESTION_UPVOTED,
  QUESTION_DOWNVOTED,
  QA_EVENT_TYPES,
  QUIZ_QUESTION_STARTED,
  QUIZ_QUESTION_UPDATED,
  QUIZ_QUESTION_CLOSED,
  SESSION_ENDED,
  SESSION_STARTED,
  INTERACTION_STARTED,
  IDEAS_EVENT_TYPES,
  applyPollResponseSubmitted,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PollRenderer, readLiveAggregateSettings, shouldShowAggregateResults } from "@liveengage/renderers";
import { RoomIdeasPanel } from "../components/RoomIdeasPanel";
import {
  RoomWaitingPlaceholder,
  ROOM_INTERACTION_WAIT_MESSAGE,
} from "../components/RoomWaitingPlaceholder";
import { ParticipantShareActions } from "../components/ParticipantShareActions";
import { RoomQaPanel } from "../components/RoomQaPanel";
import { RoomSurveyPanel } from "../components/RoomSurveyPanel";
import { formatUserFacingError } from "@liveengage/realtime";
import {
  clearParticipantSession,
  getParticipantContext,
} from "../lib/participantAuth";
import { getPoll, getPollResults, isPollType, submitPollResponse } from "../lib/pollApi";
import { patchQaVoteFromWs } from "../lib/qaCache";
import { getSessionState } from "../lib/sessionApi";
import { fetchBrandingByCode } from "../lib/brandingApi";
import { submitQuizAnswer, getActiveQuizQuestion, mapActiveQuizQuestion, type ActiveQuizQuestion } from "../lib/sprint9Api";
import {
  AppHeader,
  Modal,
  OrgBrandingProvider,
  interactionTypeLabel,
  useSystemNotice,
} from "@liveengage/ui";

function interactionStartedMessage(payload: Record<string, unknown>): string {
  const type = typeof payload.type === "string" ? payload.type : "互動";
  const label = interactionTypeLabel(type);
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title : label;
  return `「${title}」已開始，請參與 ${label}！`;
}

export function RoomPage(): React.JSX.Element {
  const ctx = getParticipantContext();
  const queryClient = useQueryClient();
  const { showError, showInfo, systemNoticeModal } = useSystemNotice();
  const [tab, setTab] = useState<"poll" | "qa" | "ideas" | "quiz" | "survey">("poll");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pollSubmitOk, setPollSubmitOk] = useState(false);
  const [quizSubmitOk, setQuizSubmitOk] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endedTitle, setEndedTitle] = useState("活動");

  const stateQuery = useQuery({
    queryKey: ["session-state", ctx?.sessionId],
    queryFn: () => getSessionState(ctx!.sessionId),
    enabled: Boolean(ctx?.sessionId),
    refetchInterval: 30_000,
  });

  const brandingQuery = useQuery({
    queryKey: ["participant-room-branding", ctx?.sessionCode],
    queryFn: () => fetchBrandingByCode(ctx!.sessionCode!),
    enabled: Boolean(ctx?.sessionCode),
    staleTime: 60_000,
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

  const activeQuizId = useMemo(() => {
    if (!ctx || !stateQuery.data) return null;
    const hit = stateQuery.data.active_interactions.find(
      (i) =>
        i.room_id === ctx.roomId &&
        i.type === "quiz" &&
        (i.status === "active" || i.status === "locked")
    );
    return hit?.id ?? null;
  }, [ctx, stateQuery.data]);

  const activeSurveyId = useMemo(() => {
    if (!ctx || !stateQuery.data) return null;
    const hit = stateQuery.data.active_interactions.find(
      (i) => i.room_id === ctx.roomId && i.type === "survey" && i.status === "active"
    );
    return hit?.id ?? null;
  }, [ctx, stateQuery.data]);

  const activeQaId = useMemo(() => {
    if (!ctx || !stateQuery.data) return null;
    const hit = stateQuery.data.active_interactions.find(
      (i) => i.room_id === ctx.roomId && i.type === "qa" && i.status === "active"
    );
    return hit?.id ?? null;
  }, [ctx, stateQuery.data]);

  const pollQuery = useQuery({
    queryKey: ["poll", activePollId],
    queryFn: () => getPoll(activePollId!),
    enabled: Boolean(activePollId),
    refetchInterval: 30_000,
  });

  const poll = pollQuery.data;
  const liveJoinEnabled = Boolean(
    poll &&
      shouldShowAggregateResults(poll, "join") &&
      !poll.result_visible &&
      (poll.status === "active" || poll.status === "locked")
  );

  const resultsQuery = useQuery({
    queryKey: ["poll-results", activePollId],
    queryFn: () => getPollResults(activePollId!),
    enabled: Boolean(
      activePollId &&
        poll &&
        (poll.result_visible || liveJoinEnabled)
    ),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    setPollSubmitOk(false);
    setSubmitError(null);
    if (activePollId) {
      void queryClient.removeQueries({ queryKey: ["poll-results", activePollId] });
    }
  }, [activePollId, queryClient]);

  const quizQuery = useQuery({
    queryKey: ["active-quiz-question", activeQuizId],
    queryFn: () => getActiveQuizQuestion(activeQuizId!),
    enabled: Boolean(activeQuizId),
    refetchInterval: 2_000,
  });

  const quizQuestion = quizQuery.data ?? null;

  useEffect(() => {
    setQuizSubmitOk(false);
  }, [quizQuestion?.id]);

  useEffect(() => {
    if (quizQuery.error) {
      showError(formatUserFacingError(quizQuery.error, "載入 Quiz 失敗"));
    }
  }, [quizQuery.error, showError]);

  useEffect(() => {
    if (stateQuery.data?.status === "ended") {
      setEndedTitle(stateQuery.data.title ?? "活動");
      setSessionEnded(true);
    }
  }, [stateQuery.data?.status, stateQuery.data?.title]);

  useEffect(() => {
    if (submitError) showError(submitError);
  }, [submitError, showError]);

  useEffect(() => {
    if (pollQuery.error) showError((pollQuery.error as Error).message);
  }, [pollQuery.error, showError]);

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      const roomId = ctx?.roomId;
      if (
        roomId &&
        (event.type === QUESTION_UPVOTED || event.type === QUESTION_DOWNVOTED)
      ) {
        patchQaVoteFromWs(queryClient, roomId, event.payload);
      } else if (QA_EVENT_TYPES.has(event.type) && roomId) {
        void queryClient.invalidateQueries({ queryKey: ["qa-public", roomId] });
      }
      switch (event.type) {
        case SESSION_STARTED: {
          const title =
            typeof event.payload.title === "string" ? event.payload.title : "活動";
          showInfo(`「${title}」已開始，歡迎參與！`, "活動已開始");
          void queryClient.invalidateQueries({
            queryKey: ["session-state", ctx?.sessionId],
          });
          break;
        }
        case INTERACTION_STARTED: {
          const type = typeof event.payload.type === "string" ? event.payload.type : "";
          showInfo(interactionStartedMessage(event.payload), "互動已開始");
          void queryClient.invalidateQueries({
            queryKey: ["session-state", ctx?.sessionId],
          });
          if (type === "ideas") setTab("ideas");
          else if (type === "qa") setTab("qa");
          else if (type === "survey") setTab("survey");
          else if (type === "quiz") setTab("quiz");
          else if (isPollType(type)) setTab("poll");
          break;
        }
        case POLL_STARTED: {
          setTab("poll");
          setPollSubmitOk(false);
          setSubmitError(null);
          showInfo("主持人已啟動投票，請參與作答！", "投票已開始");
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
        case POLL_RESULT_HIDDEN: {
          const pollId =
            typeof event.payload.poll_id === "string" ? event.payload.poll_id : null;
          if (activePollId && pollId === activePollId) {
            void queryClient.invalidateQueries({ queryKey: ["poll", activePollId] });
            void queryClient.invalidateQueries({
              queryKey: ["poll-results", activePollId],
            });
          }
          if (
            pollId &&
            activeQuizId &&
            quizQuestion?.child_interaction_id === pollId
          ) {
            if (event.type === POLL_RESULT_REVEALED) {
              const correctOptionIds =
                (event.payload.correct_option_ids as string[] | undefined) ?? [];
              queryClient.setQueryData<ActiveQuizQuestion | null>(
                ["active-quiz-question", activeQuizId],
                (old) => {
                  if (!old) return old;
                  return {
                    ...old,
                    state: "revealed",
                    result_visible: true,
                    options: old.options.map((opt) => ({
                      ...opt,
                      is_correct: correctOptionIds.includes(opt.id),
                    })),
                  };
                }
              );
            } else if (event.type === POLL_RESULT_HIDDEN) {
              queryClient.setQueryData<ActiveQuizQuestion | null>(
                ["active-quiz-question", activeQuizId],
                (old) => {
                  if (!old) return old;
                  return {
                    ...old,
                    result_visible: false,
                  };
                }
              );
            }
            void queryClient.invalidateQueries({
              queryKey: ["active-quiz-question", activeQuizId],
            });
          }
          break;
        }
        case POLL_RESPONSE_SUBMITTED: {
          const pollId =
            typeof event.payload.poll_id === "string" ? event.payload.poll_id : null;
          if (activePollId && pollId === activePollId) {
            const currentPoll = queryClient.getQueryData<typeof pollQuery.data>([
              "poll",
              activePollId,
            ]);
            const joinOn =
              currentPoll &&
              readLiveAggregateSettings(
                currentPoll.settings_public,
                currentPoll.type
              ).join;
            if (
              joinOn &&
              currentPoll &&
              (currentPoll.status === "active" || currentPoll.status === "locked")
            ) {
              applyPollResponseSubmitted(queryClient, activePollId, event.payload);
            } else {
              void queryClient.invalidateQueries({
                queryKey: ["poll-results", activePollId],
              });
            }
          }
          break;
        }
        case QUIZ_QUESTION_STARTED: {
          const q = event.payload.question as
            | Parameters<typeof mapActiveQuizQuestion>[0]
            | undefined;
          if (q) {
            if (activeQuizId) {
              queryClient.setQueryData(
                ["active-quiz-question", activeQuizId],
                mapActiveQuizQuestion(q)
              );
            }
            setTab("quiz");
            showInfo(`快問快答題目「${q.title ?? "新題目"}」已開始！`, "Quiz 已開始");
          } else if (activeQuizId) {
            void queryClient.invalidateQueries({
              queryKey: ["active-quiz-question", activeQuizId],
            });
          }
          break;
        }
        case QUIZ_QUESTION_UPDATED: {
          const q = event.payload.question as
            | Parameters<typeof mapActiveQuizQuestion>[0]
            | undefined;
          if (q && activeQuizId) {
            queryClient.setQueryData(
              ["active-quiz-question", activeQuizId],
              mapActiveQuizQuestion(q)
            );
          } else if (activeQuizId) {
            void queryClient.invalidateQueries({
              queryKey: ["active-quiz-question", activeQuizId],
            });
          }
          break;
        }
        case QUIZ_QUESTION_CLOSED: {
          if (activeQuizId) {
            queryClient.setQueryData<ActiveQuizQuestion | null>(
              ["active-quiz-question", activeQuizId],
              (old) => (old ? { ...old, state: "closed" } : old)
            );
            void queryClient.invalidateQueries({
              queryKey: ["active-quiz-question", activeQuizId],
            });
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
    [queryClient, ctx?.sessionId, ctx?.roomId, activePollId, activeQuizId, activeIdeasBoardId, quizQuestion?.child_interaction_id, showInfo],
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
      const p = pollQuery.data;
      const joinLive =
        p &&
        readLiveAggregateSettings(p.settings_public, p.type).join &&
        (p.status === "active" || p.status === "locked") &&
        !p.result_visible;
      if (p?.result_visible || joinLive) {
        void resultsQuery.refetch();
      }
    },
    onError: (err: unknown) => {
      setPollSubmitOk(false);
      setSubmitError(formatUserFacingError(err, "提交失敗"));
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
  const headerBrand = `LiveEngage 互動會場：${sessionTitle}`;

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
    <OrgBrandingProvider branding={brandingQuery.data ?? null}>
      <main className="le-page-bg min-h-full">
        <AppHeader
          brand={headerBrand}
          maxWidth="full"
          logoutLabel="離開"
          onLogout={leave}
          chromeFooterActions={<ParticipantShareActions sessionCode={sessionCode} />}
        />

      <div className="mx-auto max-w-2xl border-b border-border bg-surface/60 px-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="互動分頁">
            <TabButton active={tab === "poll"} onClick={() => setTab("poll")} live={Boolean(activePollId)}>
              意見蒐集（Poll）
            </TabButton>
            <TabButton active={tab === "quiz"} onClick={() => setTab("quiz")} live={Boolean(quizQuestion)}>
              知識評量（Quiz）與回饋
            </TabButton>
            <TabButton active={tab === "qa"} onClick={() => setTab("qa")} live={Boolean(activeQaId)}>
              發問（Q&amp;A）
            </TabButton>
            {activeIdeasBoardId ? (
              <TabButton active={tab === "ideas"} onClick={() => setTab("ideas")}>
                點子牆（Ideas）
              </TabButton>
            ) : null}
            {activeSurveyId ? (
              <TabButton active={tab === "survey"} onClick={() => setTab("survey")}>
                問卷（Survey）
              </TabButton>
            ) : null}
          </nav>
          <span
            className={`shrink-0 ${connected ? "le-status-dot-live" : "le-status-dot bg-muted"}`}
            title={connected ? "即時連線中" : "連線中斷，備援輪詢"}
          />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-6">
        {tab === "qa" ? (
          <RoomQaPanel roomId={ctx.roomId} qaOpen={Boolean(activeQaId)} />
        ) : tab === "ideas" && activeIdeasBoardId ? (
          <RoomIdeasPanel boardId={activeIdeasBoardId} />
        ) : tab === "survey" && activeSurveyId ? (
          <RoomSurveyPanel surveyId={activeSurveyId} />
        ) : tab === "quiz" ? (
          quizQuestion ? (
          <div className="le-card p-6">
            {quizQuestion.state === "revealed" && quizQuestion.result_visible ? (
              <p className="mb-2 text-xs font-medium text-emerald-700">正確答案已揭曉</p>
            ) : null}
            <h2 className="font-display text-lg font-semibold text-foreground">{quizQuestion.title}</h2>
            <ul className="mt-4 space-y-2">
              {quizSubmitOk ? (
                <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  ✓ 您已作答完成，感謝參與！
                </p>
              ) : null}
              {quizQuestion.options.map((opt) => {
                const revealed =
                  quizQuestion.state === "revealed" && quizQuestion.result_visible;
                const isCorrect = revealed && opt.is_correct === true;
                return (
                <li key={opt.id}>
                  <button
                    type="button"
                    disabled={quizSubmitting || revealed || quizSubmitOk}
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
                          setSubmitError(formatUserFacingError(err, "提交失敗"));
                        })
                        .finally(() => setQuizSubmitting(false));
                    }}
                    className={`le-btn-secondary w-full !justify-start disabled:opacity-50 ${
                      isCorrect ? "ring-2 ring-emerald-500" : ""
                    }`}
                  >
                    {opt.text}
                    {isCorrect ? " ✓" : ""}
                  </button>
                </li>
              );
              })}
            </ul>
            {quizQuestion.state === "revealed" && quizQuestion.explanation ? (
              <p className="mt-4 text-sm text-muted">{quizQuestion.explanation}</p>
            ) : null}
            <Modal
              open={quizSubmitOk}
              onClose={() => setQuizSubmitOk(false)}
              title="提交成功"
              size="sm"
            >
              <p className="text-sm text-muted">Quiz 已提交，感謝參與！</p>
            </Modal>
          </div>
          ) : (
            <RoomWaitingPlaceholder message={ROOM_INTERACTION_WAIT_MESSAGE} />
          )
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
              <RoomWaitingPlaceholder message={ROOM_INTERACTION_WAIT_MESSAGE} />
            ) : poll ? (
              <PollRenderer
                mode="answer"
                poll={poll}
                results={
                  shouldShowAggregateResults(poll, "join")
                    ? resultsQuery.data ?? null
                    : null
                }
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

      {systemNoticeModal}

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
    </OrgBrandingProvider>
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
