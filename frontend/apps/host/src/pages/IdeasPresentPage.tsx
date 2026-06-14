/** Ideas 大螢幕投影（唯讀；熱門點子；隱藏項目不顯示）。 */

import * as React from "react";
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IDEAS_EVENT_TYPES, useRoomWebSocket, type WsEvent } from "@liveengage/realtime";
import { getAccessToken } from "../lib/auth";
import { listIdeas, type IdeaPublic } from "../lib/sprint9Api";

interface Props {
  roomId: string;
  boardId: string;
}

const BACKUP_REFETCH_MS = 8_000;

export function IdeasPresentPage({ roomId, boardId }: Props): React.JSX.Element {
  const queryClient = useQueryClient();

  const ideasQuery = useQuery({
    queryKey: ["ideas-present", boardId],
    queryFn: () => listIdeas(boardId, "top"),
    refetchInterval: BACKUP_REFETCH_MS,
  });

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (!IDEAS_EVENT_TYPES.has(event.type)) return;
      void queryClient.invalidateQueries({ queryKey: ["ideas-present", boardId] });
    },
    [queryClient, boardId]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token: getAccessToken(),
    mode: "present",
    onEvent: handleWsEvent,
  });

  const items = useMemo(
    () => (ideasQuery.data?.items ?? []).filter((idea) => !idea.is_hidden),
    [ideasQuery.data?.items]
  );

  return (
    <div className="relative flex min-h-full flex-col bg-slate-950 text-slate-100">
      <div
        className="absolute right-4 top-4 z-10 flex items-center gap-1.5 opacity-40 transition-opacity hover:opacity-100"
        title={connected ? "WS 已連線（present mode）" : "WS 未連線"}
      >
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
        />
      </div>

      <header className="border-b border-slate-800 px-8 py-6 md:px-12">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          點子牆
        </h1>
        <p className="mt-2 text-sm text-slate-400">依熱度排序 · {items.length} 則</p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-8 md:px-12 md:py-10">
        {ideasQuery.isLoading ? (
          <p className="text-center text-slate-400">載入中…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-xl text-slate-500">尚無點子，歡迎投稿</p>
        ) : (
          <ul className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((idea, index) => (
              <IdeaPresentCard key={idea.id} idea={idea} rank={index + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function IdeaPresentCard({
  idea,
  rank,
}: {
  idea: IdeaPublic;
  rank: number;
}): React.JSX.Element {
  const topReactions = [...idea.reactions]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <li className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="font-mono text-2xl font-bold text-amber-400/90">#{rank}</span>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold text-amber-300">
          👍 {idea.reaction_total}
        </span>
      </div>
      <p className="flex-1 text-lg leading-relaxed text-slate-100 md:text-xl">
        {idea.content}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4 text-sm text-slate-400">
        <span>{idea.author_display ?? "匿名"}</span>
        {topReactions.length > 0 ? (
          <span className="flex gap-2">
            {topReactions.map((r) => (
              <span key={r.emoji}>
                {r.emoji} {r.count}
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </li>
  );
}
