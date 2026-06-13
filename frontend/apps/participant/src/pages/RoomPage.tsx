/** 參與者房間：顯示 active Poll 並作答（P-3 E2E）+ WS 即時推送（P-4/P-WS-1）。 */

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POLL_RESULT_HIDDEN,
  POLL_RESULT_REVEALED,
  POLL_RESPONSE_SUBMITTED,
  POLL_STARTED,
  POLL_STOPPED,
  POLL_LOCKED,
  POLL_UNLOCKED,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PollRenderer } from "@liveengage/renderers";
import { ApiException } from "../lib/api";
import {
  clearParticipantSession,
  getParticipantContext,
} from "../lib/participantAuth";
import { getPoll, getPollResults, isPollType, submitPollResponse } from "../lib/pollApi";
import { getSessionState } from "../lib/sessionApi";

export function RoomPage(): React.JSX.Element {
  const ctx = getParticipantContext();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);

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
      (i) => i.room_id === ctx.roomId && isPollType(i.type) && i.status === "active"
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

  // WS 事件處理：依事件類型決定 invalidate 策略
  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      switch (event.type) {
        case POLL_STARTED:
        case POLL_STOPPED:
          // active_interactions 清單改變，重新取 session-state
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
        default:
          break;
      }
    },
    [queryClient, ctx?.sessionId, activePollId],
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
      setSubmitOk(true);
      void pollQuery.refetch();
      void resultsQuery.refetch();
    },
    onError: (err: unknown) => {
      setSubmitOk(false);
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
          <p className="text-slate-600">請先加入活動</p>
          <a href="#/join" className="mt-4 inline-block text-primary-600 hover:underline">
            輸入活動代碼
          </a>
        </div>
      </main>
    );
  }

  const sessionTitle = stateQuery.data?.title ?? "活動";
  const poll = pollQuery.data;

  const leave = (): void => {
    clearParticipantSession();
    const code = ctx.sessionCode;
    window.location.hash = code ? `#/join/${code}` : "#/join";
  };

  return (
    <main className="min-h-full bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{sessionTitle}</h1>
            {ctx.displayName ? (
              <p className="text-xs text-slate-500">你好，{ctx.displayName}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-300"}`}
              title={connected ? "即時連線中" : "連線中斷，備援輪詢"}
            />
            <button
              type="button"
              onClick={leave}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              離開
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {submitOk ? (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            已提交，感謝參與！
          </p>
        ) : null}

        {stateQuery.isLoading ? (
          <p className="text-center text-sm text-slate-500">載入活動狀態…</p>
        ) : !activePollId ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-medium text-slate-700">等待投票開始</p>
            <p className="mt-2 text-sm text-slate-500">
              主持人啟動 Poll 後，題目會自動出現在此頁
            </p>
          </div>
        ) : pollQuery.error ? (
          <p className="text-sm text-red-600">
            {(pollQuery.error as Error).message}
          </p>
        ) : poll ? (
          <PollRenderer
            mode="answer"
            poll={poll}
            results={poll.result_visible ? resultsQuery.data ?? null : null}
            onSubmit={(answer) => {
              setSubmitOk(false);
              submitMutation.mutate(answer);
            }}
            submitting={submitMutation.isPending}
            submitError={submitError}
          />
        ) : (
          <p className="text-center text-sm text-slate-500">載入題目…</p>
        )}
      </div>
    </main>
  );
}
