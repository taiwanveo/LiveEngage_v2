/** Poll 大螢幕投影（唯讀；控場在控制台／工作台）。 */

import * as React from "react";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POLL_EVENT_TYPES,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PollRenderer } from "@liveengage/renderers";
import { getAccessToken } from "../lib/auth";
import { getPoll, getPollResults } from "../lib/pollApi";
import {
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
  const selfActionGuard = React.useRef(createSelfPollActionGuard());

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
    [queryClient, pollId, roomId]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token: getAccessToken(),
    mode: "present",
    onEvent: handleWsEvent,
  });

  const poll = pollQuery.data;

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-950">
      <div
        className="absolute right-4 top-4 z-10 flex items-center gap-1.5 opacity-40 transition-opacity hover:opacity-100"
        title={connected ? "WS 已連線（present mode）" : "WS 未連線"}
      >
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-8 py-8 md:px-12 md:py-10">
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
    </div>
  );
}
