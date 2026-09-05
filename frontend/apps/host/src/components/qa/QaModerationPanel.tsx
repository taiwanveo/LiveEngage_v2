/** Q&A 審核三欄面板（ModerationPage 與工作台 Modal 共用）。 */

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  QA_EVENT_TYPES,
  formatUserFacingError,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import { getAccessToken } from "../../lib/auth";
import { listModeration, moderate, reply, mergeDuplicateQuestions } from "../../lib/qaApi";
import type { ModerateAction, QuestionPublic, QuestionReply } from "../../types";
import { QaAiDedupBar } from "./QaAiDedupBar";
import { MergedQuestionsDetailModal } from "./MergedQuestionsDetailModal";

const WS_BACKUP_REFETCH_MS = 5_000;

interface Props {
  roomId: string;
  /** 緊湊模式：行動版以 tab 切換三欄 */
  compact?: boolean;
  /** 停用內建 WS（由父層統一處理時） */
  disableWs?: boolean;
}

export function QaModerationPanel({
  roomId,
  compact = false,
  disableWs = false,
}: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useSystemNotice();
  const seenWsEventIds = React.useRef(new Set<string>());

  const [selectedDetailQuestion, setSelectedDetailQuestion] = useState<QuestionPublic | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const {
    data: items,
    isLoading,
    error,
  } = useQuery<QuestionPublic[]>({
    queryKey: ["moderation", roomId],
    queryFn: () => listModeration(roomId),
    enabled: roomId.length > 0,
    refetchInterval: WS_BACKUP_REFETCH_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!selectedDetailQuestion || !items) return;
    const updated = items.find((q) => q.id === selectedDetailQuestion.id);
    if (updated) {
      setSelectedDetailQuestion(updated);
    }
  }, [items, selectedDetailQuestion?.id]);

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (!QA_EVENT_TYPES.has(event.type)) return;
      if (event.id) {
        if (seenWsEventIds.current.has(event.id)) return;
        seenWsEventIds.current.add(event.id);
        if (seenWsEventIds.current.size > 200) {
          const oldest = seenWsEventIds.current.values().next().value;
          if (oldest) seenWsEventIds.current.delete(oldest);
        }
      }
      void queryClient.refetchQueries({ queryKey: ["moderation", roomId] });
    },
    [queryClient, roomId]
  );

  const { connected: wsConnected } = useRoomWebSocket({
    roomId: disableWs ? null : roomId,
    token: getAccessToken(),
    mode: "host",
    enabled: !disableWs && roomId.length > 0,
    onEvent: handleWsEvent,
  });

  const moderateMutation = useMutation({
    mutationFn: ({
      questionId,
      action,
    }: {
      questionId: string;
      action: ModerateAction;
    }) => moderate(questionId, action),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["moderation", roomId] }),
    onError: (err: unknown) => showError(formatUserFacingError(err)),
  });

  const mergeMutation = useMutation({
    mutationFn: ({
      primaryId,
      duplicateId,
    }: {
      primaryId: string;
      duplicateId: string;
    }) =>
      mergeDuplicateQuestions(roomId, {
        primary_question_id: primaryId,
        duplicate_question_ids: [duplicateId],
        is_manual: true,
      }),
    onSuccess: (data) => {
      showSuccess(data.message || "已成功手動合併提問並累計按讚票數！");
      void queryClient.invalidateQueries({ queryKey: ["moderation", roomId] });
      void queryClient.invalidateQueries({ queryKey: ["qa-screen", roomId] });
      void queryClient.invalidateQueries({ queryKey: ["qa-present", roomId] });
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "手動合併題目失敗，請重試。"));
    },
  });

  const handleDragStart = (e: React.DragEvent, questionId: string) => {
    e.dataTransfer.setData("text/plain", questionId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(questionId);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e: React.DragEvent, questionId: string) => {
    if (!draggedId || draggedId === questionId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== questionId) {
      setDragOverId(questionId);
    }
  };

  const handleDragLeave = (questionId: string) => {
    if (dragOverId === questionId) {
      setDragOverId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetQuestionId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain") || draggedId;
    setDraggedId(null);
    setDragOverId(null);
    if (sourceId && targetQuestionId && sourceId !== targetQuestionId) {
      mergeMutation.mutate({
        primaryId: targetQuestionId,
        duplicateId: sourceId,
      });
    }
  };

  const grouped = useMemo(() => {
    const buckets: Record<"pending" | "approved" | "answered", QuestionPublic[]> = {
      pending: [],
      approved: [],
      answered: [],
    };
    for (const q of items ?? []) {
      if (q.status === "pending") buckets.pending.push(q);
      else if (q.status === "approved") buckets.approved.push(q);
      else if (q.status === "answered") buckets.answered.push(q);
    }
    buckets.approved.sort((a, b) => b.score - a.score);
    return buckets;
  }, [items]);

  useEffect(() => {
    if (error) showError(`載入失敗：${formatUserFacingError(error)}`);
  }, [error, showError]);

  const pendingActions = (q: QuestionPublic) => (
    <>
      <ActionButton
        variant="primary"
        onClick={() => moderateMutation.mutate({ questionId: q.id, action: "approve" })}
        disabled={moderateMutation.isPending}
        title="核准此問題並公開顯示於投影幕與名單"
      >
        核准
      </ActionButton>
      <ActionButton
        variant="ghost"
        onClick={() => moderateMutation.mutate({ questionId: q.id, action: "dismiss" })}
        disabled={moderateMutation.isPending}
        title="駁回此問題，不公開顯示"
      >
        駁回
      </ActionButton>
    </>
  );

  const approvedActions = (q: QuestionPublic, ctx: QuestionCardActionsCtx) => (
    <>
      <ReplyForm
        questionId={q.id}
        existing={q.replies}
        roomId={roomId}
        onOpenChange={ctx.setReplyFormOpen}
      />
      <ActionButton
        variant="ghost"
        onClick={() => moderateMutation.mutate({ questionId: q.id, action: "unapprove" })}
        disabled={moderateMutation.isPending}
        title="撤回核准，移回待審區"
      >
        取消核准
      </ActionButton>
      <ActionButton
        variant="primary"
        onClick={() => moderateMutation.mutate({ questionId: q.id, action: "answer" })}
        disabled={moderateMutation.isPending}
        title="標記為已回答"
      >
        標為已答
      </ActionButton>
      <ActionButton
        variant="ghost"
        onClick={() =>
          moderateMutation.mutate({
            questionId: q.id,
            action: q.highlighted ? "unhighlight" : "highlight",
          })
        }
        disabled={moderateMutation.isPending}
        title={q.highlighted ? "取消精選問題標記" : "標記為精選問題（大螢幕醒目提示）"}
      >
        {q.highlighted ? "取消標記" : "標記"}
      </ActionButton>
      <ActionButton
        variant="ghost"
        onClick={() => moderateMutation.mutate({ questionId: q.id, action: "archive" })}
        disabled={moderateMutation.isPending}
        title="封存此問題，不再顯示於審核列表中"
      >
        封存
      </ActionButton>
    </>
  );

  const answeredActions = (q: QuestionPublic, ctx: QuestionCardActionsCtx) => (
    <>
      <ReplyForm
        questionId={q.id}
        existing={q.replies}
        roomId={roomId}
        onOpenChange={ctx.setReplyFormOpen}
      />
      <ActionButton
        variant="ghost"
        onClick={() => moderateMutation.mutate({ questionId: q.id, action: "unanswer" })}
        disabled={moderateMutation.isPending}
        title="取消已回答狀態，移回已核准區"
      >
        取消已答
      </ActionButton>
      <ActionButton
        variant="ghost"
        onClick={() => moderateMutation.mutate({ questionId: q.id, action: "archive" })}
        disabled={moderateMutation.isPending}
        title="封存此問題，不再顯示於審核列表中"
      >
        封存
      </ActionButton>
    </>
  );

  const dragHandlers = {
    draggedId,
    dragOverId,
    isMerging: mergeMutation.isPending,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    onOpenMergedDetail: (q: QuestionPublic) => setSelectedDetailQuestion(q),
  };

  if (compact) {
    return (
      <>
        <QaAiDedupBar roomId={roomId} />
        <div className="mb-2.5 flex items-center gap-1.5 rounded-lg border border-primary-500/20 bg-primary-500/5 px-3 py-1.5 text-xs text-muted">
          <span className="text-primary-500">💡</span>
          <span>按住問題卡片拖曳至另一題即可手動合併；點擊「聚合」標籤可檢視原始提問或解除合併。</span>
        </div>
        <CompactQaPanel
          grouped={grouped}
          loading={isLoading}
          wsConnected={disableWs ? true : wsConnected}
          pendingActions={pendingActions}
          approvedActions={approvedActions}
          answeredActions={answeredActions}
          {...dragHandlers}
        />
        {selectedDetailQuestion && (
          <MergedQuestionsDetailModal
            roomId={roomId}
            question={selectedDetailQuestion}
            onClose={() => setSelectedDetailQuestion(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      {!disableWs && !wsConnected ? (
        <p className="mb-3 text-xs text-amber-700">
          即時連線中斷，每 {WS_BACKUP_REFETCH_MS / 1000} 秒自動同步審核列表。
        </p>
      ) : null}
      <QaAiDedupBar roomId={roomId} />
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3.5 py-2 text-xs text-muted">
        <span className="text-purple-600 dark:text-purple-400 font-bold">💡 操作提示：</span>
        <span>可直接按住任一問題卡片拖曳疊加至另一題進行人工合併；點擊「聚合」彩色標籤可檢視原始提問或單獨解除合併。</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Column
          title="待審"
          accent="amber"
          questions={grouped.pending}
          loading={isLoading}
          renderActions={(q, _ctx) => pendingActions(q)}
          {...dragHandlers}
        />
        <Column
          title="已核准"
          accent="blue"
          questions={grouped.approved}
          loading={isLoading}
          renderActions={(q, ctx) => approvedActions(q, ctx)}
          {...dragHandlers}
        />
        <Column
          title="已回答"
          accent="emerald"
          questions={grouped.answered}
          loading={isLoading}
          renderActions={(q, ctx) => answeredActions(q, ctx)}
          {...dragHandlers}
        />
      </div>
      {selectedDetailQuestion && (
        <MergedQuestionsDetailModal
          roomId={roomId}
          question={selectedDetailQuestion}
          onClose={() => setSelectedDetailQuestion(null)}
        />
      )}
    </>
  );
}

/** 待審問題數（工作台 badge 用） */
export function useQaPendingCount(roomId: string): number {
  const { data } = useQuery({
    queryKey: ["moderation", roomId],
    queryFn: () => listModeration(roomId),
    enabled: roomId.length > 0,
    refetchInterval: WS_BACKUP_REFETCH_MS,
  });
  return (data ?? []).filter((q) => q.status === "pending").length;
}

function CompactQaPanel(props: {
  grouped: Record<"pending" | "approved" | "answered", QuestionPublic[]>;
  loading: boolean;
  wsConnected: boolean;
  pendingActions: (q: QuestionPublic) => React.JSX.Element;
  approvedActions: (q: QuestionPublic, ctx: QuestionCardActionsCtx) => React.JSX.Element;
  answeredActions: (q: QuestionPublic, ctx: QuestionCardActionsCtx) => React.JSX.Element;
  draggedId: string | null;
  dragOverId: string | null;
  isMerging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: (id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onOpenMergedDetail: (q: QuestionPublic) => void;
}): React.JSX.Element {
  const [tab, setTab] = useState<"pending" | "approved" | "answered">("pending");
  const tabs = [
    { id: "pending" as const, label: "待審", accent: "amber" as const },
    { id: "approved" as const, label: "已核准", accent: "blue" as const },
    { id: "answered" as const, label: "已回答", accent: "emerald" as const },
  ];

  return (
    <>
      {!props.wsConnected ? (
        <p className="mb-2 text-xs text-amber-700">即時連線中斷，自動同步中…</p>
      ) : null}
      <div className="mb-3 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-2.5 py-1 text-xs ${
              tab === t.id
                ? "bg-accent text-accent-fg"
                : "bg-muted/20 text-muted hover:bg-muted/30"
            }`}
          >
            {t.label} ({props.grouped[t.id].length})
          </button>
        ))}
      </div>
      <Column
        title={tabs.find((t) => t.id === tab)!.label}
        accent={tabs.find((t) => t.id === tab)!.accent}
        questions={props.grouped[tab]}
        loading={props.loading}
        renderActions={(q, ctx) => {
          if (tab === "pending") return props.pendingActions(q);
          if (tab === "approved") return props.approvedActions(q, ctx);
          return props.answeredActions(q, ctx);
        }}
        draggedId={props.draggedId}
        dragOverId={props.dragOverId}
        isMerging={props.isMerging}
        onDragStart={props.onDragStart}
        onDragEnd={props.onDragEnd}
        onDragOver={props.onDragOver}
        onDragLeave={props.onDragLeave}
        onDrop={props.onDrop}
        onOpenMergedDetail={props.onOpenMergedDetail}
      />
    </>
  );
}

const ACCENT_CLASSES: Record<string, string> = {
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  blue: "bg-blue-50 border-blue-200 text-blue-800",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

function Column(columnProps: {
  title: string;
  accent: "amber" | "blue" | "emerald";
  questions: QuestionPublic[];
  loading: boolean;
  renderActions: (
    q: QuestionPublic,
    ctx: QuestionCardActionsCtx
  ) => React.JSX.Element;
  draggedId: string | null;
  dragOverId: string | null;
  isMerging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: (id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onOpenMergedDetail: (q: QuestionPublic) => void;
}): React.JSX.Element {
  return (
    <section className="flex min-h-[280px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <header
        className={`rounded-t-xl border-b px-4 py-2 ${ACCENT_CLASSES[columnProps.accent]}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{columnProps.title}</h2>
          <span className="font-mono text-xs">{columnProps.questions.length}</span>
        </div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {columnProps.loading ? (
          <p className="py-8 text-center text-sm text-slate-400">載入中…</p>
        ) : columnProps.questions.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">尚無問題</p>
        ) : (
          columnProps.questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              renderActions={(ctx) => columnProps.renderActions(q, ctx)}
              draggedId={columnProps.draggedId}
              dragOverId={columnProps.dragOverId}
              isMerging={columnProps.isMerging}
              onDragStart={columnProps.onDragStart}
              onDragEnd={columnProps.onDragEnd}
              onDragOver={columnProps.onDragOver}
              onDragLeave={columnProps.onDragLeave}
              onDrop={columnProps.onDrop}
              onOpenMergedDetail={columnProps.onOpenMergedDetail}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface QuestionCardActionsCtx {
  setReplyFormOpen: (open: boolean) => void;
}

function questionAuthorLabel(q: QuestionPublic): string {
  if (q.is_anonymous) return "匿名";
  const name = q.author_display?.trim();
  return name || "未署名";
}

function QuestionCard(cardProps: {
  question: QuestionPublic;
  renderActions: (ctx: QuestionCardActionsCtx) => React.JSX.Element;
  draggedId: string | null;
  dragOverId: string | null;
  isMerging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: (id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onOpenMergedDetail: (q: QuestionPublic) => void;
}): React.JSX.Element {
  const q = cardProps.question;
  const [hovered, setHovered] = useState(false);
  const [replyFormOpen, setReplyFormOpen] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);

  useEffect(() => {
    setCoarsePointer(
      window.matchMedia("(hover: none) and (pointer: coarse)").matches
    );
  }, []);

  const showActions = coarsePointer || hovered || replyFormOpen;
  const hasMerged = Boolean(q.merged_questions && q.merged_questions.length > 0);
  const isManual = Boolean(q.is_manual_merge);
  const isDragging = cardProps.draggedId === q.id;
  const isTarget = cardProps.dragOverId === q.id;

  let cardStyle = "rounded-xl border p-3.5 transition-all shadow-xs relative select-text cursor-grab active:cursor-grabbing ";
  if (isTarget) {
    cardStyle += "ring-2 ring-purple-500 border-purple-400 bg-purple-50/70 dark:bg-purple-950/40 scale-[1.02] shadow-md z-10";
  } else if (isDragging) {
    cardStyle += "opacity-40 scale-95 border-dashed border-primary-500 bg-slate-50";
  } else if (hasMerged) {
    cardStyle += isManual
      ? "border-purple-300 dark:border-purple-700/60 bg-purple-50/30 dark:bg-purple-950/20 ring-1 ring-purple-400/25"
      : "border-amber-300 dark:border-amber-700/60 bg-amber-50/30 dark:bg-amber-950/20 ring-1 ring-amber-400/25";
  } else {
    cardStyle += "border-slate-200 bg-white dark:border-slate-800 dark:bg-surface hover:shadow-sm";
  }

  return (
    <article
      className={cardStyle}
      draggable={!cardProps.isMerging}
      onDragStart={(e) => cardProps.onDragStart(e, q.id)}
      onDragEnd={cardProps.onDragEnd}
      onDragOver={(e) => cardProps.onDragOver(e, q.id)}
      onDragLeave={() => cardProps.onDragLeave(q.id)}
      onDrop={(e) => cardProps.onDrop(e, q.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="按住此問題可拖曳至另一題進行人工合併"
    >
      {/* 聚合狀態徽章 */}
      {hasMerged && (
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              cardProps.onOpenMergedDetail(q);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-2xs transition hover:scale-105 active:scale-95 ${
              isManual
                ? "border border-purple-300 bg-purple-100 text-purple-700 hover:bg-purple-200 dark:border-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                : "border border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
            }`}
            title="點擊查看包含的原始提問明細或單獨解除合併"
          >
            <span>{isManual ? "👤✨" : "✨"}</span>
            <span>
              {isManual ? "手動聚合" : "AI 智慧聚合"} ({q.merged_questions?.length ?? 0} 則已合併)
            </span>
            <span className="text-[10px] opacity-75">🔍 點擊查看明細</span>
          </button>
        </div>
      )}

      <p className="whitespace-pre-wrap break-words text-sm text-slate-900 dark:text-foreground">{q.content}</p>
      {q.replies.length > 0 ? (
        <ul className="mt-2 space-y-1 border-l-2 border-primary-100 pl-3">
          {q.replies.map((r) => (
            <li key={r.id} className="text-xs text-slate-600 dark:text-muted">
              <span className="font-medium text-primary-700 dark:text-primary-400">主持人：</span>
              {r.content}
              {r.is_private ? (
                <span className="ml-1 text-amber-600 dark:text-amber-400">（私密）</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-muted">
        <span>發問者：{questionAuthorLabel(q)}</span>
        <span>👍 {q.upvote_count}</span>
        <span>👎 {q.downvote_count}</span>
        {q.highlighted ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">★ 已標記</span>
        ) : null}
      </div>
      {showActions ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="問題操作">
          {cardProps.renderActions({ setReplyFormOpen })}
        </div>
      ) : null}
    </article>
  );
}

function ReplyForm(formProps: {
  questionId: string;
  existing: QuestionReply[];
  roomId: string;
  onOpenChange?: (open: boolean) => void;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const setReplyOpen = (next: boolean): void => {
    setOpen(next);
    formProps.onOpenChange?.(next);
  };

  const replyMutation = useMutation({
    mutationFn: () => reply(formProps.questionId, content.trim(), isPrivate),
    onSuccess: () => {
      setContent("");
      setReplyOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ["moderation", formProps.roomId],
      });
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err));
    },
  });

  if (!open) {
    return (
      <ActionButton
        variant="ghost"
        onClick={() => setReplyOpen(true)}
        title="以主持人身分回覆提問者（公開或私密）"
      >
        回覆
      </ActionButton>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-surface-raised">
      <textarea
        rows={2}
        maxLength={2000}
        placeholder="輸入回覆內容…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-surface dark:text-foreground"
      />
      <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-muted">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        僅提問者可見（私密回覆）
      </label>
      <div className="flex gap-2">
        <ActionButton
          variant="primary"
          disabled={replyMutation.isPending || !content.trim()}
          onClick={() => replyMutation.mutate()}
          title="送出回覆內容"
        >
          {replyMutation.isPending ? "送出中…" : "送出回覆"}
        </ActionButton>
        <ActionButton
          variant="ghost"
          onClick={() => setReplyOpen(false)}
          title="取消編輯回覆"
        >
          取消
        </ActionButton>
      </div>
      {formProps.existing.length > 0 ? (
        <p className="text-xs text-slate-400">已有 {formProps.existing.length} 則回覆</p>
      ) : null}
      {systemNoticeModal}
    </div>
  );
}

function ActionButton(props: {
  variant: "primary" | "ghost";
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const base =
    "text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-50";
  const variant =
    props.variant === "primary"
      ? "bg-primary-600 hover:bg-primary-700 text-white"
      : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-surface-raised dark:hover:bg-surface-hover dark:text-foreground";
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={`${base} ${variant}`}
    >
      {props.children}
    </button>
  );
}
