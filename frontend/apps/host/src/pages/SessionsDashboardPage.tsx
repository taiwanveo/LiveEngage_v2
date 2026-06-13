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
import { JoinShareCard } from "../components/JoinShareCard";
import { ApiException } from "../lib/api";
import { AppHeader } from "@liveengage/ui";

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

  return (
    <main className="le-page-bg min-h-full">
      <AppHeader
        brand="LiveEngage Host"
        tagline="活動儀表板（sessions）"
        maxWidth="4xl"
        onLogout={onLogout}
      />

      <div className="relative z-10 mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <section className="le-card p-6 animate-slide-up">
          <h2 className="font-display text-lg font-semibold text-foreground">建立新活動</h2>
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
              className="le-input flex-1"
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="le-btn-primary shrink-0"
            >
              {createMutation.isPending ? "建立中…" : "建立並進入審核"}
            </button>
          </form>
          {error ? (
            <p className="mt-2 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">我的活動</h2>
          {sessionsQuery.isLoading ? (
            <p className="text-sm text-muted">載入中…</p>
          ) : sessionsQuery.error ? (
            <p className="text-sm text-danger">
              {(sessionsQuery.error as Error).message}
            </p>
          ) : sessionsQuery.data?.length === 0 ? (
            <p className="le-card border-dashed p-8 text-center text-sm text-muted">
              尚無活動，請先建立一場活動。
            </p>
          ) : (
            <ul className="space-y-4">
              {sessionsQuery.data?.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
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
  onGoLive: () => void;
  onEnd: () => void;
  statusPending: boolean;
}): React.JSX.Element {
  const { session } = props;
  const roomId = session.default_room_id;

  return (
    <li className="le-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{session.title}</h3>
          <p className="mt-1 font-mono text-sm text-accent">{session.code}</p>
          <p className="mt-1 text-xs text-muted">
            {STATUS_LABEL[session.status]}
            {roomId ? (
              <>
                {" "}
                · room{" "}
                <span className="font-mono text-muted/80">
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
              className="le-btn-primary !min-h-[36px] !px-3 !py-1.5 !text-xs"
            >
              設為進行中（go live）
            </button>
          ) : null}
          {session.status === "live" ? (
            <button
              type="button"
              disabled={props.statusPending}
              onClick={props.onEnd}
              className="le-btn-secondary !min-h-[36px] !px-3 !py-1.5 !text-xs"
            >
              結束活動
            </button>
          ) : null}
        </div>
      </div>

      {roomId ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <a href={`#/rooms/${roomId}/moderation`} className="le-nav-link le-nav-link-active !text-xs">
            Q&amp;A 審核
          </a>
          <a href={`#/rooms/${roomId}/polls`} className="le-nav-link !text-xs">
            Poll 管理
          </a>
        </div>
      ) : (
        <p className="mt-3 text-xs text-warning">此活動尚無房間，請聯絡管理員。</p>
      )}

      <JoinShareCard
        code={session.code}
        joinUrl={participantJoinUrl(session.code)}
      />
    </li>
  );
}
