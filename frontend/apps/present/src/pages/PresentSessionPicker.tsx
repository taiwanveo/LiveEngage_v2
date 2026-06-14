/** 登入後選擇活動與 Poll 進行投影。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@liveengage/ui";
import {
  isPollType,
  listInteractions,
  listSessions,
  presentPollUrl,
  type SessionHost,
} from "../lib/sessionApi";

interface Props {
  onLogout: () => void;
}

export function PresentSessionPicker({ onLogout }: Props): React.JSX.Element {
  const sessionsQuery = useQuery({
    queryKey: ["present-sessions"],
    queryFn: listSessions,
  });

  return (
    <main className="le-page-bg min-h-full">
      <AppHeader
        brand="投影展示"
        tagline="投影展示（present）"
        maxWidth="2xl"
        onLogout={onLogout}
      />

      <div className="relative z-10 mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        {sessionsQuery.isLoading ? (
          <p className="text-muted">載入活動…</p>
        ) : sessionsQuery.error ? (
          <p className="text-danger">{(sessionsQuery.error as Error).message}</p>
        ) : sessionsQuery.data?.length === 0 ? (
          <p className="le-card border-dashed p-8 text-center text-muted">
            尚無活動。請先在 Host 建立活動並建立 Poll。
          </p>
        ) : (
          <ul className="space-y-4">
            {sessionsQuery.data?.map((session) => (
              <SessionPollList key={session.id} session={session} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function SessionPollList(props: { session: SessionHost }): React.JSX.Element {
  const roomId = props.session.default_room_id;

  const interactionsQuery = useQuery({
    queryKey: ["present-interactions", roomId],
    queryFn: () => listInteractions(roomId!),
    enabled: Boolean(roomId),
  });

  const polls =
    interactionsQuery.data?.filter((i) => isPollType(i.type)) ?? [];

  return (
    <li className="le-card p-5 animate-slide-up">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-foreground">{props.session.title}</h2>
        <span className="font-mono text-sm text-accent">{props.session.code}</span>
      </div>
      <p className="mt-1 text-xs text-muted">狀態：{props.session.status}</p>

      {interactionsQuery.isLoading ? (
        <p className="mt-3 text-sm text-muted">載入互動項目…</p>
      ) : polls.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          目前沒有可投影的 Poll（請在 Host 建立並啟動 Poll）。
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {polls.map((poll) => {
            const rid = poll.room_id || roomId;
            if (!rid) return null;
            return (
              <li key={poll.id}>
                <a
                  href={presentPollUrl(rid, poll.id)}
                  className="le-btn-secondary w-full !justify-between"
                >
                  <span>{poll.title ?? poll.type}</span>
                  <span className="text-xs text-muted">{poll.status}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
