/** Q&A 大螢幕投影（唯讀；僅已核准／已回答；控場在審核頁）。 */

import * as React from "react";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QA_EVENT_TYPES, useRoomWebSocket, type WsEvent } from "@liveengage/realtime";
import { PRESENT_PAGE_TITLE_CLASS } from "@liveengage/ui";
import { getAccessToken } from "../lib/auth";
import { listPublicQuestions } from "../lib/qaApi";
import type { QuestionPublic } from "../types";

interface Props {
  roomId: string;
}

const BACKUP_REFETCH_MS = 10_000;

export function QaPresentPage({ roomId }: Props): React.JSX.Element {
  const queryClient = useQueryClient();

  const questionsQuery = useQuery({
    queryKey: ["qa-present", roomId],
    queryFn: () => listPublicQuestions(roomId, "top"),
    refetchInterval: BACKUP_REFETCH_MS,
  });

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (!QA_EVENT_TYPES.has(event.type)) return;
      void queryClient.invalidateQueries({ queryKey: ["qa-present", roomId] });
    },
    [queryClient, roomId]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token: getAccessToken(),
    mode: "present",
    onEvent: handleWsEvent,
  });

  const items = questionsQuery.data ?? [];

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <div
        className="absolute right-4 top-4 z-10 flex items-center gap-1.5 opacity-40 transition-opacity hover:opacity-100"
        title={connected ? "WS 已連線（present mode）" : "WS 未連線"}
      >
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
        />
      </div>

      <header className="border-b border-slate-800 px-8 py-4 md:px-12">
        <h1 className={PRESENT_PAGE_TITLE_CLASS}>Q&amp;A</h1>
        <p className="mt-2 text-sm text-slate-400">
          熱門問題 · {items.length} 則
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-8 pb-40 md:px-12 md:py-10 md:pb-48">
        {questionsQuery.isLoading ? (
          <p className="text-center text-slate-400">載入中…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-xl text-slate-500">尚無已核准問題</p>
        ) : (
          <ul className="mx-auto max-w-5xl space-y-6">
            {items.map((q, index) => (
              <QaPresentCard key={q.id} question={q} rank={index + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QaPresentCard({
  question,
  rank,
}: {
  question: QuestionPublic;
  rank: number;
}): React.JSX.Element {
  const [isHovered, setIsHovered] = React.useState(false);
  const publicReplies = (question.replies ?? []).filter((r) => !r.is_private);
  const hasMerged = Boolean(question.merged_questions && question.merged_questions.length > 0);
  const isManual = Boolean(question.is_manual_merge);

  let borderClass = "border-slate-800 bg-slate-900/80";
  if (question.highlighted) {
    borderClass = "border-amber-500/80 bg-slate-900/90 ring-2 ring-amber-500/40";
  } else if (hasMerged) {
    borderClass = isManual
      ? "border-purple-500/60 bg-slate-900/90 ring-1 ring-purple-500/30 hover:border-purple-400"
      : "border-amber-500/60 bg-slate-900/90 ring-1 ring-amber-500/30 hover:border-amber-400";
  }

  return (
    <li
      className={`relative rounded-2xl border p-6 md:p-8 transition-all ${borderClass}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-4">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/20 font-display text-lg font-bold text-sky-300">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {question.highlighted ? (
              <span className="text-lg text-amber-400" title="精選問題" aria-hidden>
                ★
              </span>
            ) : null}
            {question.status === "answered" ? (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                已回答
              </span>
            ) : null}
            {hasMerged ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-2xs ${
                  isManual
                    ? "bg-purple-500/20 text-purple-300 border border-purple-400/40"
                    : "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                }`}
                title="滑鼠移動至問題上方可檢視合併前的個別提問"
              >
                <span>{isManual ? "👤✨" : "✨"}</span>
                <span>
                  {isManual ? "手動聚合" : "AI 語意聚合"} (已合併 {question.merged_questions?.length ?? 0} 則同義題)
                </span>
              </span>
            ) : null}
          </div>
          <p className="mt-2 whitespace-pre-wrap font-display text-2xl font-semibold leading-snug text-white md:text-3xl">
            {question.content}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span>{question.is_anonymous ? "匿名" : question.author_display ?? "—"}</span>
            <span>👍 {question.upvote_count}</span>
          </div>
          {publicReplies.length > 0 ? (
            <div className="mt-4 space-y-2 border-l-2 border-sky-500/40 pl-4">
              {publicReplies.map((r) => (
                <p key={r.id} className="text-base text-slate-300 md:text-lg">
                  <span className="font-medium text-sky-300">主持人：</span>
                  {r.content}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* 滑鼠 Hover 浮現尚未合併前的個別原始提問清單 */}
      {hasMerged && isHovered && (
        <div
          className="absolute left-6 right-6 top-[calc(100%-8px)] z-50 rounded-2xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl backdrop-blur-md transition-all duration-200 animate-in fade-in zoom-in-95"
          style={{ minWidth: "300px" }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <span className={isManual ? "text-purple-400 font-bold" : "text-amber-400 font-bold"}>
                {isManual ? "👤✨" : "✨"}
              </span>
              <span className="text-sm font-bold text-white">
                {isManual ? "手動合併前原始個別提問" : "AI 語意歸併前原始個別提問"} ({question.merged_questions?.length ?? 0} 則)
              </span>
            </div>
            <span className="text-xs text-slate-400">
              票數已全數累計至主提問
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {question.merged_questions?.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl border border-slate-800 bg-slate-800/80 p-3 text-xs space-y-1 transition hover:border-slate-600"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-200">
                    {sub.is_anonymous ? "匿名發問者" : (sub.author_display || "未署名")}
                  </span>
                  <span className="font-mono text-sky-400 font-semibold">
                    原獲得 👍 {sub.upvote_count} 票
                  </span>
                </div>
                <p className="text-slate-200 text-sm leading-relaxed font-normal">
                  {sub.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
