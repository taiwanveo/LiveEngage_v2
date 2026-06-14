/** PM-004：投影全螢幕 + 控制列 + 鍵盤快捷鍵（S6-3）+ WS 即時推送（P-4/P-WS-1）。 */

import * as React from "react";
import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POLL_EVENT_TYPES,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PollRenderer } from "@liveengage/renderers";
import { getAccessToken } from "../lib/auth";
import { getPoll, getPollResults, pollAction } from "../lib/pollApi";
import type { PollAction, InteractionStatus } from "../lib/pollTypes";
import {
  applyHostPollActionSuccess,
  createSelfPollActionGuard,
  handleHostPollWsEvent,
  POLL_RESULTS_BACKUP_REFETCH_MS,
} from "../lib/pollActionCache";

interface Props {
  roomId: string;
  pollId: string;
}

export function PresentPage({ roomId, pollId }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const selfActionGuard = useRef(createSelfPollActionGuard());

  // WS 事件觸發 invalidate；30s 輪詢作安全備援
  const pollQuery = useQuery({
    queryKey: ["poll", pollId],
    queryFn: () => getPoll(pollId),
    refetchInterval: POLL_RESULTS_BACKUP_REFETCH_MS,
  });

  const resultsQuery = useQuery({
    queryKey: ["poll-results", pollId],
    queryFn: () => getPollResults(pollId),
    enabled: Boolean(pollQuery.data),
    refetchInterval: POLL_RESULTS_BACKUP_REFETCH_MS,
  });

  const actionMutation = useMutation({
    mutationFn: (action: PollAction) => pollAction(pollId, action),
    onSuccess: (data, action) => {
      selfActionGuard.current.mark(pollId);
      applyHostPollActionSuccess(queryClient, {
        roomId,
        pollId,
        action,
        data,
      });
    },
  });

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (!POLL_EVENT_TYPES.has(event.type)) return;
      handleHostPollWsEvent(queryClient, {
        event,
        pollId,
        roomId,
        guard: selfActionGuard.current,
      });
    },
    [queryClient, pollId, roomId],
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token: getAccessToken(),
    mode: "host",
    onEvent: handleWsEvent,
  });

  const poll = pollQuery.data;
  const status: InteractionStatus | undefined = poll?.status;

  const toggleStartStop = useCallback((): void => {
    if (!status) return;
    if (status === "idle" || status === "stopped") {
      actionMutation.mutate("start");
    } else if (status === "active" || status === "locked") {
      actionMutation.mutate("stop");
    }
  }, [status, actionMutation]);

  const toggleLock = useCallback((): void => {
    if (status === "active") actionMutation.mutate("lock");
    else if (status === "locked") actionMutation.mutate("unlock");
  }, [status, actionMutation]);

  const toggleReveal = useCallback((): void => {
    if (!poll) return;
    actionMutation.mutate(poll.result_visible ? "hide" : "reveal");
  }, [poll, actionMutation]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          toggleStartStop();
          break;
        case "l":
          toggleLock();
          break;
        case "r":
          toggleReveal();
          break;
        case "escape":
          window.location.hash = `#/rooms/${roomId}/polls/${pollId}/console`;
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleStartStop, toggleLock, toggleReveal, roomId, pollId]);

  return (
    <div className="flex min-h-full flex-col bg-slate-950">
      {/* WS 連線指示燈（僅開發時顯示） */}
      <div className="absolute right-4 top-4 flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-500"}`}
          title={connected ? "WS 已連線" : "WS 未連線"}
        />
        {!connected && (
          <span className="text-xs text-slate-500">輪詢備援中</span>
        )}
      </div>

      <div className="flex-1 p-8 md:p-12">
        {poll ? (
          <PollRenderer
            mode="present"
            poll={poll}
            results={resultsQuery.data ?? null}
          />
        ) : (
          <p className="text-center text-slate-400">載入中…</p>
        )}
      </div>

      <PresentControlBar
        status={status}
        resultVisible={poll?.result_visible ?? false}
        responseCount={resultsQuery.data?.response_count ?? 0}
        pending={actionMutation.isPending}
        onStartStop={toggleStartStop}
        onLock={toggleLock}
        onReveal={toggleReveal}
        onExit={() => {
          window.location.hash = `#/rooms/${roomId}/polls/${pollId}/console`;
        }}
      />
    </div>
  );
}

interface ControlBarProps {
  status: InteractionStatus | undefined;
  resultVisible: boolean;
  responseCount: number;
  pending: boolean;
  onStartStop: () => void;
  onLock: () => void;
  onReveal: () => void;
  onExit: () => void;
}

export function PresentControlBar({
  status,
  resultVisible,
  responseCount,
  pending,
  onStartStop,
  onLock,
  onReveal,
  onExit,
}: ControlBarProps): React.JSX.Element {
  const startStopLabel =
    status === "active" || status === "locked" ? "結束 (Space)" : "開始 (Space)";

  return (
    <footer className="border-t border-white/10 bg-black/80 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          <span className="mr-3">狀態：{status ?? "—"}</span>
          <span className="mr-3">回應：{responseCount}</span>
          <span>L 鎖定 · R 揭示 · Esc 離開</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <BarButton onClick={onStartStop} disabled={pending}>
            {startStopLabel}
          </BarButton>
          <BarButton
            onClick={onLock}
            disabled={pending || (status !== "active" && status !== "locked")}
          >
            {status === "locked" ? "解鎖 (L)" : "鎖定 (L)"}
          </BarButton>
          <BarButton onClick={onReveal} disabled={pending}>
            {resultVisible ? "隱藏結果 (R)" : "揭示結果 (R)"}
          </BarButton>
          <BarButton onClick={onExit}>離開控制台</BarButton>
        </div>
      </div>
    </footer>
  );
}

function BarButton(props: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-40"
    >
      {props.children}
    </button>
  );
}
