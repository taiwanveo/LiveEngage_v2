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
import { listModeration, moderate, reply } from "../../lib/qaApi";
import type { ModerateAction, QuestionPublic, QuestionReply } from "../../types";
import { QaAiDedupBar } from "./QaAiDedupBar";

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
  const { showError } = useSystemNotice();
  const seenWsEventIds = React.useRef(new Set<string>());

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
      >
        核准
      </ActionButton>
      <ActionButton
        variant="ghost"
        onClick={() => moderateMutation.mutate({ questionId: q.id, action: "dismiss" })}
        disabled={moderateMutation.isPending}
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
      >
        取消核准
      </ActionButton>
      <ActionButton
        variant="primary"
        onClick={() => moderateMutation.mutate({ questionId: q.id, action: "answer" })}
        disabled={moderateMutation.isPending}
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
      >
        {q.highlighted ? "取消標記" : "標記"}
      </ActionButton>
      <ActionButton
        variant="ghost"
        onClick={() => moderateMutation.mutate({ questionId: q.id, action: "archive" })}
        disabled={moderateMutation.isPending}
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
      >
        取消已答
      </ActionButton>
      <ActionButton
        variant="ghost"
        onClick={() => moderateMutation.mutate({ questionId: q.id, action: "archive" })}
        disabled={moderateMutation.isPending}
      >
        封存
      </ActionButton>
    </>
  );

  if (compact) {
    return (
      <>
        <QaAiDedupBar roomId={roomId} />
        <CompactQaPanel
          grouped={grouped}
          loading={isLoading}
          wsConnected={disableWs ? true : wsConnected}
          pendingActions={pendingActions}
          approvedActions={approvedActions}
          answeredActions={answeredActions}
        />
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Column
          title="待審"
          accent="amber"
          questions={grouped.pending}
          loading={isLoading}
          renderActions={(q, _ctx) => pendingActions(q)}
        />
        <Column
          title="已核准"
          accent="blue"
          questions={grouped.approved}
          loading={isLoading}
          renderActions={(q, ctx) => approvedActions(q, ctx)}
        />
        <Column
          title="已回答"
          accent="emerald"
          questions={grouped.answered}
          loading={isLoading}
          renderActions={(q, ctx) => answeredActions(q, ctx)}
        />
      </div>
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

  return (
    <article
      className="rounded-lg border border-slate-200 bg-white p-3 transition-shadow hover:shadow-sm"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{q.content}</p>
      {q.replies.length > 0 ? (
        <ul className="mt-2 space-y-1 border-l-2 border-primary-100 pl-3">
          {q.replies.map((r) => (
            <li key={r.id} className="text-xs text-slate-600">
              <span className="font-medium text-primary-700">主持人：</span>
              {r.content}
              {r.is_private ? (
                <span className="ml-1 text-amber-600">（私密）</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>發問者：{questionAuthorLabel(q)}</span>
        <span>👍 {q.upvote_count}</span>
        <span>👎 {q.downvote_count}</span>
        {q.highlighted ? (
          <span className="font-medium text-amber-600">★ 已標記</span>
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
      <ActionButton variant="ghost" onClick={() => setReplyOpen(true)}>
        回覆
      </ActionButton>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <textarea
        rows={2}
        maxLength={2000}
        placeholder="輸入回覆內容…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <label className="flex items-center gap-1 text-xs text-slate-600">
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
        >
          {replyMutation.isPending ? "送出中…" : "送出回覆"}
        </ActionButton>
        <ActionButton variant="ghost" onClick={() => setReplyOpen(false)}>
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
  children: React.ReactNode;
}): React.JSX.Element {
  const base =
    "text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-50";
  const variant =
    props.variant === "primary"
      ? "bg-primary-600 hover:bg-primary-700 text-white"
      : "bg-slate-100 hover:bg-slate-200 text-slate-700";
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={`${base} ${variant}`}
    >
      {props.children}
    </button>
  );
}
