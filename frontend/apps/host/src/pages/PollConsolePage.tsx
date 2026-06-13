/** Poll 現場控制台（BE-005）：控場動作 + WS 即時結果（P-4/P-WS-1）。 */

import * as React from "react";
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POLL_EVENT_TYPES,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PollRenderer } from "@liveengage/renderers";
import { getAccessToken } from "../lib/auth";
import { HostShell } from "../components/HostShell";
import { getPoll, getPollResults, pollAction } from "../lib/pollApi";
import type { PollAction } from "../lib/pollTypes";

interface Props {
  roomId: string;
  pollId: string;
  onLogout: () => void;
}

const ACTIONS: { action: PollAction; label: string; needsConfirm?: boolean }[] = [
  { action: "start", label: "開始" },
  { action: "stop", label: "結束" },
  { action: "lock", label: "鎖定" },
  { action: "unlock", label: "解鎖" },
  { action: "reveal", label: "揭示結果" },
  { action: "hide", label: "隱藏結果" },
  { action: "reset", label: "重置", needsConfirm: true },
];

export function PollConsolePage({
  roomId,
  pollId,
  onLogout,
}: Props): React.JSX.Element {
  const queryClient = useQueryClient();

  // 取得 Poll 資料：WS 觸發 invalidate，refetchInterval 30s 作安全備援
  const pollQuery = useQuery({
    queryKey: ["poll", pollId],
    queryFn: () => getPoll(pollId),
    refetchInterval: 30_000,
  });

  const resultsQuery = useQuery({
    queryKey: ["poll-results", pollId],
    queryFn: () => getPollResults(pollId),
    enabled: Boolean(pollQuery.data),
    refetchInterval: 30_000,
  });

  const actionMutation = useMutation({
    mutationFn: ({
      action,
      confirm,
    }: {
      action: PollAction;
      confirm?: boolean;
    }) => pollAction(pollId, action, confirm ?? false),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
      void queryClient.invalidateQueries({ queryKey: ["poll-results", pollId] });
    },
  });

  // WS 事件處理：Poll 相關事件立即觸發 re-fetch
  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (!POLL_EVENT_TYPES.has(event.type)) return;
      void queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
      void queryClient.invalidateQueries({ queryKey: ["poll-results", pollId] });
    },
    [queryClient, pollId],
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token: getAccessToken(),
    mode: "host",
    onEvent: handleWsEvent,
  });

  const poll = pollQuery.data;
  const results = resultsQuery.data ?? null;
  const err = pollQuery.error ?? resultsQuery.error ?? actionMutation.error;

  const runAction = (action: PollAction, needsConfirm?: boolean): void => {
    if (needsConfirm && !window.confirm("確定要重置並清除所有作答？")) return;
    actionMutation.mutate({ action, confirm: needsConfirm ?? false });
  };

  return (
    <HostShell
      title="Poll 控制台"
      subtitle={poll ? `${poll.type} · ${poll.status}` : ""}
      roomId={roomId}
      onLogout={onLogout}
      actions={
        <div className="flex items-center gap-3">
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-300"}`}
            title={connected ? "WS 已連線" : "WS 未連線"}
          />
          <a
            href={`#/rooms/${roomId}/polls/${pollId}/present`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            投影模式
          </a>
        </div>
      }
    >
      {err ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(err as Error).message}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {ACTIONS.map(({ action, label, needsConfirm }) => (
          <button
            key={action}
            type="button"
            disabled={actionMutation.isPending}
            onClick={() => runAction(action, needsConfirm)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>

      {poll ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">投影預覽</h3>
            <PollRenderer mode="present" poll={poll} results={results} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">參與者視角</h3>
            <PollRenderer
              mode="answer"
              poll={poll}
              results={poll.result_visible ? results : null}
            />
            <p className="mt-2 text-xs text-slate-500">
              回應數：{results?.response_count ?? 0}
              {poll.result_visible ? " · 結果已揭示" : " · 結果未揭示"}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">載入中…</p>
      )}
    </HostShell>
  );
}
