/** 登入後選擇活動與 Poll 進行投影。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
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
    <main className="flex min-h-full items-start justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">選擇投影內容</h1>
            <p className="mt-1 text-sm text-slate-400">
              選擇活動與 Poll，在大螢幕開啟投影頁
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="text-sm text-slate-500 hover:text-slate-300"
          >
            登出（sign out）
          </button>
        </header>

        {sessionsQuery.isLoading ? (
          <p className="text-slate-400">載入活動…</p>
        ) : sessionsQuery.error ? (
          <p className="text-red-400">{(sessionsQuery.error as Error).message}</p>
        ) : sessionsQuery.data?.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-slate-900 p-8 text-center text-slate-400">
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
    <li className="rounded-xl border border-white/10 bg-slate-900 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-white">{props.session.title}</h2>
        <span className="font-mono text-sm text-primary-400">{props.session.code}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">狀態：{props.session.status}</p>

      {interactionsQuery.isLoading ? (
        <p className="mt-3 text-sm text-slate-500">載入互動項目…</p>
      ) : polls.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
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
                  className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700"
                >
                  <span>{poll.title ?? poll.type}</span>
                  <span className="text-xs text-slate-400">{poll.status}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
