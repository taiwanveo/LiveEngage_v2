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
import { PollControlBar } from "../components/PollControlBar";
import { HostTitleActions, HostTitleLink } from "../components/HostTitleActions";
import { getPoll, getPollResults, pollAction } from "../lib/pollApi";
import type { PollAction } from "../lib/pollTypes";
import { presentAppUrl } from "../lib/presentUrl";

interface Props {
  roomId: string;
  pollId: string;
  onLogout: () => void;
}

export function PollConsolePage({
  roomId,
  pollId,
  onLogout,
}: Props): React.JSX.Element {
  const queryClient = useQueryClient();

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
      presentPollId={pollId}
      onLogout={onLogout}
      activeNav="polls"
      titleAddon={
        <HostTitleActions>
          <span
            className={`le-status-dot ${connected ? "le-status-dot-live" : "bg-muted"}`}
            title={connected ? "WS 已連線" : "WS 未連線"}
          />
          <HostTitleLink
            href={presentAppUrl(roomId, pollId)}
            variant="primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            投影模式
          </HostTitleLink>
          <HostTitleLink
            href={`#/rooms/${roomId}/polls/${pollId}/present`}
            variant="secondary"
          >
            內嵌投影
          </HostTitleLink>
        </HostTitleActions>
      }
    >
      {err ? (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {(err as Error).message}
        </div>
      ) : null}

      {poll ? (
        <>
          <PollControlBar
            poll={poll}
            pending={actionMutation.isPending}
            onToggle={runAction}
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">投影預覽</h3>
              <PollRenderer mode="present" poll={poll} results={results} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">參與者視角</h3>
              <PollRenderer
                mode="answer"
                poll={poll}
                results={poll.result_visible ? results : null}
              />
              <p className="mt-2 text-xs text-muted">
                回應數：{results?.response_count ?? 0}
                {poll.result_visible ? " · 結果已揭示" : " · 結果未揭示"}
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">載入中…</p>
      )}
    </HostShell>
  );
}
