/** PM-002 審核 UI：pending / approved / answered 三欄。
 *
 * 鐵律：
 *  - 寫入走 REST `/moderate`、`/replies`（鐵律 1）
 *  - 計數讀後端聚合值（鐵律 2）
 *  - 匿名顯示來自 mask_identity serializer（鐵律 3）
 *  - 寫入帶 Idempotency-Key（鐵律 4；qaApi 已處理）
 */

import * as React from "react";
import { useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listModeration, moderate } from "../lib/qaApi";
import type {
  ModerateAction,
  QuestionPublic,
  QuestionStatus,
} from "../types";

interface Props {
  roomId: string;
  onLogout: () => void;
}

const REFRESH_INTERVAL_MS = 4_000;

export function ModerationPage({ roomId, onLogout }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const validRoom = roomId !== "_" && roomId.length > 0;

  const {
    data: items,
    isLoading,
    error,
    refetch,
  } = useQuery<QuestionPublic[]>({
    queryKey: ["moderation", roomId],
    queryFn: () => listModeration(roomId),
    enabled: validRoom,
    refetchInterval: REFRESH_INTERVAL_MS,
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

  if (!validRoom) {
    return <RoomPicker onLogout={onLogout} />;
  }

  return (
    <main className="min-h-full bg-slate-100">
      <Topbar
        roomId={roomId}
        onRefresh={() => void refetch()}
        onLogout={onLogout}
      />

      {error ? (
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            載入失敗（load failed）：{(error as Error).message}
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Column
          title="待審（pending）"
          accent="amber"
          questions={grouped.pending}
          loading={isLoading}
          renderActions={(q) => (
            <>
              <ActionButton
                variant="primary"
                onClick={() =>
                  moderateMutation.mutate({ questionId: q.id, action: "approve" })
                }
                disabled={moderateMutation.isPending}
              >
                核准（approve）
              </ActionButton>
              <ActionButton
                variant="ghost"
                onClick={() =>
                  moderateMutation.mutate({ questionId: q.id, action: "dismiss" })
                }
                disabled={moderateMutation.isPending}
              >
                駁回（dismiss）
              </ActionButton>
            </>
          )}
        />

        <Column
          title="已核准（approved）"
          accent="blue"
          questions={grouped.approved}
          loading={isLoading}
          renderActions={(q) => (
            <>
              <ActionButton
                variant="primary"
                onClick={() =>
                  moderateMutation.mutate({ questionId: q.id, action: "answer" })
                }
                disabled={moderateMutation.isPending}
              >
                標為已答（answer）
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
                {q.highlighted ? "取消標記（unhighlight）" : "標記（highlight）"}
              </ActionButton>
              <ActionButton
                variant="ghost"
                onClick={() =>
                  moderateMutation.mutate({ questionId: q.id, action: "archive" })
                }
                disabled={moderateMutation.isPending}
              >
                封存（archive）
              </ActionButton>
            </>
          )}
        />

        <Column
          title="已回答（answered）"
          accent="emerald"
          questions={grouped.answered}
          loading={isLoading}
          renderActions={(q) => (
            <>
              <ActionButton
                variant="ghost"
                onClick={() =>
                  moderateMutation.mutate({ questionId: q.id, action: "unanswer" })
                }
                disabled={moderateMutation.isPending}
              >
                取消已答（unanswer）
              </ActionButton>
              <ActionButton
                variant="ghost"
                onClick={() =>
                  moderateMutation.mutate({ questionId: q.id, action: "archive" })
                }
                disabled={moderateMutation.isPending}
              >
                封存（archive）
              </ActionButton>
            </>
          )}
        />
      </div>
    </main>
  );
}

function Topbar(props: {
  roomId: string;
  onRefresh: () => void;
  onLogout: () => void;
}): React.JSX.Element {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Q&amp;A 審核（moderation）
          </h1>
          <p className="text-xs text-slate-500 font-mono">room: {props.roomId}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`#/rooms/${props.roomId}/polls`}
            className="text-sm px-3 py-1.5 rounded-md bg-primary-50 hover:bg-primary-100 text-primary-700"
          >
            Poll 管理
          </a>
          <button
            onClick={props.onRefresh}
            className="text-sm px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            重新整理（refresh）
          </button>
          <button
            onClick={props.onLogout}
            className="text-sm px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900"
          >
            登出（sign out）
          </button>
        </div>
      </div>
    </header>
  );
}

const ACCENT_CLASSES: Record<string, string> = {
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  blue: "bg-blue-50 border-blue-200 text-blue-800",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

function Column(props: {
  title: string;
  accent: "amber" | "blue" | "emerald";
  questions: QuestionPublic[];
  loading: boolean;
  renderActions: (q: QuestionPublic) => React.JSX.Element;
}): React.JSX.Element {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[400px]">
      <header
        className={`rounded-t-xl px-4 py-2 border-b ${ACCENT_CLASSES[props.accent]}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{props.title}</h2>
          <span className="text-xs font-mono">{props.questions.length}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {props.loading ? (
          <p className="text-sm text-slate-400 text-center py-8">
            載入中…（loading）
          </p>
        ) : props.questions.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">尚無問題</p>
        ) : (
          props.questions.map((q) => (
            <QuestionCard key={q.id} question={q} actions={props.renderActions(q)} />
          ))
        )}
      </div>
    </section>
  );
}

function QuestionCard(props: {
  question: QuestionPublic;
  actions: React.JSX.Element;
}): React.JSX.Element {
  const q = props.question;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 hover:shadow-sm transition-shadow">
      <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">
        {q.content}
      </p>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        <span>作者 {q.is_anonymous ? "匿名" : q.author_display ?? "—"}</span>
        <span>讚 {q.upvote_count}</span>
        {q.downvote_count > 0 ? <span>倒讚 {q.downvote_count}</span> : null}
        <span>分 {q.score}</span>
        {q.highlighted ? (
          <span className="text-amber-600 font-medium">★ 已標記</span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{props.actions}</div>
    </article>
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

function RoomPicker(props: { onLogout: () => void }): React.JSX.Element {
  return (
    <main className="min-h-full flex items-center justify-center bg-slate-100 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg text-center space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">請指定活動室（room）</h2>
        <p className="text-sm text-slate-600 text-left leading-relaxed">
          請從活動儀表板選擇活動，或將網址中的佔位符換成實際 room ID：
        </p>
        <a
          href="#/dashboard"
          className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          前往活動儀表板
        </a>
        <code className="block bg-slate-100 px-3 py-2 rounded text-xs font-mono text-slate-800 break-all">
          #/rooms/&lt;roomId&gt;/moderation
        </code>
        <p className="text-sm text-slate-600 text-left leading-relaxed">
          <strong>roomId</strong> 可從建立活動 API{" "}
          <code className="bg-slate-100 px-1 rounded text-xs">POST /api/v1/sessions</code>{" "}
          回應的 <code className="bg-slate-100 px-1 rounded text-xs">room_id</code>{" "}
          取得，或至 Neon 的 <code className="bg-slate-100 px-1 rounded text-xs">rooms</code>{" "}
          表查詢。Host 活動儀表板（建 session UI）尚待實作。
        </p>
        <button
          onClick={props.onLogout}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          登出（sign out）
        </button>
      </div>
    </main>
  );
}

export type { QuestionStatus };
