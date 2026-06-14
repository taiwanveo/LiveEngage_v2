/** 投影全螢幕 Poll 展示（唯讀；控場在 Host 控制台）。 */

import * as React from "react";
import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POLL_EVENT_TYPES,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PollRenderer } from "@liveengage/renderers";
import { useSystemNotice } from "@liveengage/ui";
import { getAccessToken } from "../lib/auth";
import { getPoll, getPollResults } from "../lib/pollApi";

interface Props {
  roomId: string;
  pollId: string;
}

export function PollPresentPage({ roomId, pollId }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();

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
    mode: "present",
    onEvent: handleWsEvent,
  });

  const poll = pollQuery.data;
  const err = pollQuery.error ?? resultsQuery.error;

  useEffect(() => {
    if (err) showError((err as Error).message);
  }, [err, showError]);

  return (
    <div className="relative flex min-h-full flex-col bg-slate-950">
      {/* 連線指示燈：投影時低調顯示 */}
      <div
        className="absolute right-4 top-4 z-10 flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity"
        title={connected ? "WS 已連線（present mode）" : "WS 未連線"}
      >
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
        />
      </div>

      <div className="flex-1 p-8 md:p-12 lg:p-16">
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
      {systemNoticeModal}
    </div>
  );
}
