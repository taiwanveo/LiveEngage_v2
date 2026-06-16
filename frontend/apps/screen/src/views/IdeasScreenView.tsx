/** Ideas 投影視圖。 */

import * as React from "react";
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IDEAS_EVENT_TYPES, useRoomWebSocket, type WsEvent } from "@liveengage/realtime";
import { PRESENT_IDEA_BODY_CLASS, PRESENT_PAGE_TITLE_CLASS } from "@liveengage/ui";
import { getScreenToken } from "../lib/screenAuth";
import { listIdeas, type IdeaPublic } from "../lib/sprint9Api";

interface Props {
  roomId: string;
  boardId: string;
}

const BACKUP_MS = 8_000;

export function IdeasScreenView({ roomId, boardId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const token = getScreenToken();

  const ideasQuery = useQuery({
    queryKey: ["ideas-screen", boardId],
    queryFn: () => listIdeas(boardId, "top"),
    refetchInterval: BACKUP_MS,
  });

  const handleWs = useCallback(
    (event: WsEvent) => {
      if (!IDEAS_EVENT_TYPES.has(event.type)) return;
      void qc.invalidateQueries({ queryKey: ["ideas-screen", boardId] });
    },
    [qc, boardId]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token,
    mode: "screen",
    onEvent: handleWs,
  });

  const items = useMemo(
    () => (ideasQuery.data?.items ?? []).filter((idea) => !idea.is_hidden),
    [ideasQuery.data?.items]
  );

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <div className="absolute right-4 top-4 z-10 opacity-90" title={connected ? "WS 已連線" : "WS 未連線"}>
        <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
      </div>
      <header className="border-b border-slate-800 px-8 py-4 md:px-12">
        <h1 className={PRESENT_PAGE_TITLE_CLASS}>點子牆</h1>
        <p className="mt-1.5 text-xs text-slate-400">依熱度排序 · {items.length} 則</p>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
        {ideasQuery.isLoading ? (
          <p className="text-center text-slate-400">載入中…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-lg text-slate-500">尚無點子</p>
        ) : (
          <ul className="mx-auto grid max-w-[90rem] grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((idea, index) => (
              <IdeaCard key={idea.id} idea={idea} rank={index + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function IdeaCard({ idea, rank }: { idea: IdeaPublic; rank: number }): React.JSX.Element {
  const topReactions = [...idea.reactions].sort((a, b) => b.count - a.count).slice(0, 3);
  return (
    <li className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-mono text-lg font-bold text-amber-400/90">#{rank}</span>
        <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-amber-300">
          👍 {idea.reaction_total}
        </span>
      </div>
      <p className={PRESENT_IDEA_BODY_CLASS}>{idea.content}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2 text-xs text-slate-400">
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
