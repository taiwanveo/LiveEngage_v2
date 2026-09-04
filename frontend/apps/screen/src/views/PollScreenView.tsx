/** Poll 投影視圖。 */

import * as React from "react";
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POLL_EVENT_TYPES,
  POLL_RESPONSE_SUBMITTED,
  applyPollResponseSubmitted,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PollRenderer, shouldPresentPollResults } from "@liveengage/renderers";
import { getScreenToken } from "../lib/screenAuth";
import { getPoll, getPollResults, POLL_RESULTS_BACKUP_REFETCH_MS } from "../lib/pollApi";
import type { ScreenSubView } from "../lib/screenApi";

interface Props {
  roomId: string;
  pollId: string;
  subView: ScreenSubView;
}

export function PollScreenView({ roomId, pollId, subView }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const token = getScreenToken();
  const [screenClusterOverride, setScreenClusterOverride] = React.useState<
    boolean | undefined
  >(undefined);

  const pollQuery = useQuery({
    queryKey: ["poll", pollId],
    queryFn: () => getPoll(pollId),
    refetchInterval: POLL_RESULTS_BACKUP_REFETCH_MS,
  });

  const poll = pollQuery.data;
  const showResults = useMemo(
    () => (poll ? shouldPresentPollResults(poll, { subView }) : false),
    [poll, subView]
  );

  const resultsQuery = useQuery({
    queryKey: ["poll-results", pollId, screenClusterOverride],
    queryFn: () => getPollResults(pollId, screenClusterOverride),
    enabled: Boolean(poll && showResults),
    refetchInterval: POLL_RESULTS_BACKUP_REFETCH_MS,
  });

  const isEffectiveClustered =
    screenClusterOverride !== undefined
      ? screenClusterOverride
      : Boolean(
          resultsQuery.data?.is_ai_clustered || poll?.settings_public?.ai_cluster
        );

  const handleWs = useCallback(
    (event: WsEvent) => {
      if (!POLL_EVENT_TYPES.has(event.type)) return;
      if (event.type === POLL_RESPONSE_SUBMITTED) {
        const eventPollId = String(event.payload.poll_id ?? "");
        if (eventPollId === pollId) {
          applyPollResponseSubmitted(qc, pollId, event.payload);
        }
      }
      void qc.invalidateQueries({ queryKey: ["poll", pollId] });
      if (event.type !== POLL_RESPONSE_SUBMITTED) {
        void qc.invalidateQueries({ queryKey: ["poll-results", pollId] });
      }
    },
    [qc, pollId]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token,
    mode: "screen",
    onEvent: handleWs,
  });

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-950">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-3">
        {poll?.type === "word_cloud" && (
          <button
            type="button"
            onClick={() =>
              setScreenClusterOverride((prev) =>
                prev === undefined ? !isEffectiveClustered : !prev
              )
            }
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3.5 py-1 text-xs font-semibold text-white/90 shadow-xl backdrop-blur-md transition-all hover:bg-black/75 hover:scale-105 active:scale-95"
            title="點擊切換投影端語意聚合或原始詞彙視圖"
          >
            <span>
              {isEffectiveClustered ? "✨ AI 語意聚合模式" : "🔤 原始詞彙模式"}
            </span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] text-white/80">
              切換
            </span>
          </button>
        )}
        <div
          className="opacity-90"
          title={connected ? "WS 已連線" : "WS 未連線"}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? "bg-emerald-400" : "bg-red-400"
            }`}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-8 py-8 md:px-12 md:py-10">
        {poll ? (
          <PollRenderer
            mode="present"
            poll={poll}
            results={showResults ? (resultsQuery.data ?? null) : null}
          />
        ) : (
          <p className="text-center text-slate-400">載入 Poll…</p>
        )}
      </div>
    </div>
  );
}
