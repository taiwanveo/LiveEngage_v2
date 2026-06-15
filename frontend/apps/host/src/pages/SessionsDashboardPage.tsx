/** Host 活動儀表板：建立活動、列表、進入審核／Poll、分享加入連結。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSession,
  listSessions,
  updateSession,
  type SessionHost,
  type SessionStatus,
} from "../lib/sessionApi";
import { formatUserFacingError } from "@liveengage/realtime";
import { AppHeader, JoinShareCard, Modal, participantJoinUrl, useSystemNotice } from "@liveengage/ui";
import { HOST_DASHBOARD_HASH } from "../components/HostShell";

interface Props {
  onLogout: () => void;
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  draft: "草稿",
  live: "進行中",
  ended: "已結束",
  archived: "已封存",
};

export function SessionsDashboardPage({ onLogout }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");

  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });

  const createMutation = useMutation({
    mutationFn: () => createSession({ title: title.trim() }),
    onSuccess: (session) => {
      setTitle("");
      setCreateOpen(false);
      void qc.invalidateQueries({ queryKey: ["host-sessions"] });
      if (session.default_room_id) {
        window.location.hash = `#/rooms/${session.default_room_id}/workbench`;
      }
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "建立失敗"));
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
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "更新失敗"));
    },
  });

  function archiveSession(session: SessionHost): void {
    if (
      !window.confirm(
        `確定要封存「${session.title}」？\n\n封存後將從儀表板移出，資料仍保留供匯出與稽核。`
      )
    ) {
      return;
    }
    statusMutation.mutate({ sessionId: session.id, status: "archived" });
  }

  function openCreateModal(): void {
    setTitle("");
    setCreateOpen(true);
  }

  function closeCreateModal(): void {
    if (createMutation.isPending) return;
    setCreateOpen(false);
    setTitle("");
  }

  React.useEffect(() => {
    if (sessionsQuery.error) {
      showError(formatUserFacingError(sessionsQuery.error));
    }
  }, [sessionsQuery.error, showError]);

  return (
    <main className="le-page-bg min-h-full">
      <AppHeader
        brand="LiveEngage Host"
        brandHref={HOST_DASHBOARD_HASH}
        tagline="活動儀表板"
        taglineAddon={
          <button type="button" onClick={openCreateModal} className="le-btn-primary !min-h-[32px] !px-3 !py-1 !text-xs">
            建立新活動
          </button>
        }
        maxWidth="6xl"
        onLogout={onLogout}
      />

      <Modal open={createOpen} onClose={closeCreateModal} title="建立新活動" size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            createMutation.mutate();
          }}
        >
          <label className="block">
            <span className="text-sm font-medium text-foreground">活動名稱</span>
            <input
              type="text"
              required
              autoFocus
              maxLength={255}
              placeholder="請輸入活動名稱"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="le-input mt-2 w-full"
            />
          </label>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={createMutation.isPending} className="le-btn-primary">
              {createMutation.isPending ? "建立中…" : "建立活動"}
            </button>
          </div>
        </form>
      </Modal>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section>
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">我的活動</h2>
          {sessionsQuery.isLoading ? (
            <p className="text-sm text-muted">載入中…</p>
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
                  onArchive={() => archiveSession(session)}
                  statusPending={statusMutation.isPending}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
      {systemNoticeModal}
    </main>
  );
}

function SessionCard(props: {
  session: SessionHost;
  onGoLive: () => void;
  onEnd: () => void;
  onArchive: () => void;
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
                <span className="font-mono text-muted/80 break-all">
                  {roomId}
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
          {session.status === "ended" || session.status === "draft" ? (
            <button
              type="button"
              disabled={props.statusPending}
              onClick={props.onArchive}
              className="le-btn-primary !min-h-[36px] !px-3 !py-1.5 !text-xs"
            >
              封存
            </button>
          ) : null}
        </div>
      </div>

      {roomId ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <a href={`#/rooms/${roomId}/workbench`} className="le-btn-primary !min-h-[36px] !px-4 !text-xs">
            進入工作台
          </a>
          <a href={`#/rooms/${roomId}/moderation`} className="le-nav-link !text-xs">
            Q&amp;A 審核
          </a>
          <a href={`#/rooms/${roomId}/polls`} className="le-nav-link !text-xs">
            Poll 管理
          </a>
          <a href={`#/rooms/${roomId}/sprint9`} className="le-nav-link !text-xs">
            Quiz 管理
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
