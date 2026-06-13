/** Host 活動儀表板：建立活動、列表、進入審核／Poll、分享加入連結。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSession,
  listSessions,
  participantJoinUrl,
  updateSession,
  type SessionHost,
  type SessionStatus,
} from "../lib/sessionApi";
import { ApiException } from "../lib/api";

interface Props {
  onLogout: () => void;
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  draft: "草稿（draft）",
  live: "進行中（live）",
  ended: "已結束（ended）",
  archived: "已封存（archived）",
};

export function SessionsDashboardPage({ onLogout }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });

  const createMutation = useMutation({
    mutationFn: () => createSession({ title: title.trim() }),
    onSuccess: (session) => {
      setTitle("");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["host-sessions"] });
      if (session.default_room_id) {
        window.location.hash = `#/rooms/${session.default_room_id}/moderation`;
      }
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiException ? err.error.message : "建立失敗");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      sessionId,
      status,
    }: {
      sessionId: string;
      status: SessionStatus;
    }) => updateSession(sessionId, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["host-sessions"] }),
  });

  async function copyJoinLink(session: SessionHost): Promise<void> {
    const url = participantJoinUrl(session.code);
    await navigator.clipboard.writeText(url);
    setCopiedId(session.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <main className="min-h-full bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">LiveEngage Host</h1>
            <p className="text-sm text-slate-500">活動儀表板（sessions）</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            登出（sign out）
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">建立新活動</h2>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              createMutation.mutate();
            }}
          >
            <input
              type="text"
              required
              maxLength={255}
              placeholder="活動名稱"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:bg-slate-400"
            >
              {createMutation.isPending ? "建立中…" : "建立並進入審核"}
            </button>
          </form>
          {error ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">我的活動</h2>
          {sessionsQuery.isLoading ? (
            <p className="text-sm text-slate-500">載入中…</p>
          ) : sessionsQuery.error ? (
            <p className="text-sm text-red-600">
              {(sessionsQuery.error as Error).message}
            </p>
          ) : sessionsQuery.data?.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              尚無活動，請先建立一場活動。
            </p>
          ) : (
            <ul className="space-y-4">
              {sessionsQuery.data?.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  copied={copiedId === session.id}
                  onCopyJoin={() => void copyJoinLink(session)}
                  onGoLive={() =>
                    statusMutation.mutate({ sessionId: session.id, status: "live" })
                  }
                  onEnd={() =>
                    statusMutation.mutate({ sessionId: session.id, status: "ended" })
                  }
                  statusPending={statusMutation.isPending}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function SessionCard(props: {
  session: SessionHost;
  copied: boolean;
  onCopyJoin: () => void;
  onGoLive: () => void;
  onEnd: () => void;
  statusPending: boolean;
}): React.JSX.Element {
  const { session } = props;
  const roomId = session.default_room_id;

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{session.title}</h3>
          <p className="mt-1 font-mono text-sm text-primary-700">{session.code}</p>
          <p className="mt-1 text-xs text-slate-500">
            {STATUS_LABEL[session.status]}
            {roomId ? (
              <>
                {" "}
                · room{" "}
                <span className="font-mono text-slate-400">
                  {roomId.slice(0, 8)}…
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.status === "draft" ? (
            <button
              type="button"
              disabled={props.statusPending}
              onClick={props.onGoLive}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              設為進行中（go live）
            </button>
          ) : null}
          {session.status === "live" ? (
            <button
              type="button"
              disabled={props.statusPending}
              onClick={props.onEnd}
              className="rounded-md bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              結束活動
            </button>
          ) : null}
          <button
            type="button"
            onClick={props.onCopyJoin}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200"
          >
            {props.copied ? "已複製連結" : "複製參與連結"}
          </button>
        </div>
      </div>

      {roomId ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <a
            href={`#/rooms/${roomId}/moderation`}
            className="rounded-md bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-800 hover:bg-primary-100"
          >
            Q&amp;A 審核
          </a>
          <a
            href={`#/rooms/${roomId}/polls`}
            className="rounded-md bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-800 hover:bg-primary-100"
          >
            Poll 管理
          </a>
        </div>
      ) : (
        <p className="mt-3 text-xs text-amber-700">此活動尚無房間，請聯絡管理員。</p>
      )}

      <p className="mt-3 break-all text-xs text-slate-400">
        參與者：{participantJoinUrl(session.code)}
      </p>
    </li>
  );
}
