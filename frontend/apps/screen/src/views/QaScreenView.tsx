/** Q&A 投影視圖。 */

import * as React from "react";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QA_EVENT_TYPES, useRoomWebSocket, type WsEvent } from "@liveengage/realtime";
import { PRESENT_PAGE_TITLE_CLASS } from "@liveengage/ui";
import { getScreenToken } from "../lib/screenAuth";
import { listPublicQuestions } from "../lib/qaApi";
import type { QuestionPublic } from "../types";

interface Props {
  roomId: string;
}

const BACKUP_MS = 10_000;

export function QaScreenView({ roomId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const token = getScreenToken();

  const questionsQuery = useQuery({
    queryKey: ["qa-screen", roomId],
    queryFn: () => listPublicQuestions(roomId, "top"),
    refetchInterval: BACKUP_MS,
  });

  const handleWs = useCallback(
    (event: WsEvent) => {
      if (!QA_EVENT_TYPES.has(event.type)) return;
      void qc.invalidateQueries({ queryKey: ["qa-screen", roomId] });
    },
    [qc, roomId]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token,
    mode: "screen",
    onEvent: handleWs,
  });

  const items = questionsQuery.data ?? [];

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <div className="absolute right-4 top-4 z-10 opacity-90" title={connected ? "WS 已連線" : "WS 未連線"}>
        <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
      </div>
      <header className="border-b border-border px-8 py-5 md:px-12">
        <h1 className={PRESENT_PAGE_TITLE_CLASS}>Q&amp;A</h1>
        <p className="mt-2 text-sm text-muted">熱門問題 · {items.length} 則</p>
      </header>
      <div className="flex-1 overflow-y-auto px-8 py-8 pb-40 md:px-12 md:py-10 md:pb-48">
        {questionsQuery.isLoading ? (
          <p className="text-center text-muted">載入中…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-xl text-muted">尚無已核准問題</p>
        ) : (
          <ul className="mx-auto max-w-5xl space-y-6">
            {items.map((q, index) => (
              <QaCard key={q.id} question={q} rank={index + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QaCard({ question, rank }: { question: QuestionPublic; rank: number }): React.JSX.Element {
  const [isHovered, setIsHovered] = React.useState(false);
  const publicReplies = (question.replies ?? []).filter((r) => !r.is_private);
  const hasMerged = Boolean(question.merged_questions && question.merged_questions.length > 0);
  const isManual = Boolean(question.is_manual_merge);

  let borderClass = "border-border bg-surface shadow-card";
  if (question.highlighted) {
    borderClass = "border-amber-400 bg-surface shadow-lg ring-2 ring-amber-400/40";
  } else if (hasMerged) {
    borderClass = isManual
      ? "border-purple-400/60 dark:border-purple-500/60 bg-surface shadow-card ring-1 ring-purple-400/30 hover:border-purple-400"
      : "border-amber-400/60 dark:border-amber-500/60 bg-surface shadow-card ring-1 ring-amber-400/30 hover:border-amber-400";
  }

  return (
    <li
      className={`relative rounded-2xl border p-6 md:p-8 transition-all ${borderClass}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-4">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-muted font-display text-lg font-bold text-accent">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {question.highlighted ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                ★ 精選問題
              </span>
            ) : null}
            {hasMerged ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-2xs ${
                  isManual
                    ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-400/30"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30"
                }`}
                title="滑鼠移動至問題上方可檢視合併前的個別提問"
              >
                <span>{isManual ? "👤✨" : "✨"}</span>
                <span>
                  {isManual ? "手動聚合" : "AI 語意聚合"} (已合併 {question.merged_questions?.length ?? 0} 則同義題)
                </span>
              </span>
            ) : null}
            <p className="w-full whitespace-pre-wrap font-display text-2xl font-semibold leading-snug text-foreground md:text-3xl">
              {question.content}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-medium text-muted">
            <span>{question.is_anonymous ? "匿名" : (question.author_display ?? "—")}</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground/80">
              <span aria-hidden>👍</span>
              <span>{question.upvote_count}</span>
            </span>
          </div>
          {publicReplies.length > 0 ? (
            <div className="mt-4 space-y-2 border-l-2 border-accent/60 pl-4">
              {publicReplies.map((r) => (
                <p key={r.id} className="text-base text-foreground/90 md:text-lg">
                  <span className="font-semibold text-accent">主持人：</span>
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
          className="absolute left-6 right-6 top-[calc(100%-8px)] z-50 rounded-2xl border border-border bg-surface/95 p-5 text-foreground shadow-2xl backdrop-blur-md transition-all duration-200 animate-in fade-in zoom-in-95"
          style={{ minWidth: "300px" }}
        >
          <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <span className={isManual ? "text-purple-600 dark:text-purple-400 font-bold" : "text-amber-500 font-bold"}>
                {isManual ? "👤✨" : "✨"}
              </span>
              <span className="text-sm font-bold text-foreground">
                {isManual ? "手動合併前原始個別提問" : "AI 語意歸併前原始個別提問"} ({question.merged_questions?.length ?? 0} 則)
              </span>
            </div>
            <span className="text-xs text-muted">
              票數已全數累計至主提問
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {question.merged_questions?.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl border border-border/80 bg-surface-raised/80 p-3 text-xs space-y-1 transition hover:border-primary-400/50"
              >
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span className="font-semibold text-foreground/90">
                    {sub.is_anonymous ? "匿名發問者" : (sub.author_display || "未署名")}
                  </span>
                  <span className="font-mono text-accent font-semibold">
                    原獲得 👍 {sub.upvote_count} 票
                  </span>
                </div>
                <p className="text-foreground text-sm leading-relaxed font-normal">
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
