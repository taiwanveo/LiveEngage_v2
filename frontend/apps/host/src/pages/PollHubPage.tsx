/** Poll 列表與建立入口（S6-2）。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HostShell } from "../components/HostShell";
import { createInteraction, listInteractions } from "../lib/interactionApi";
import {
  isPollType,
  POLL_TYPES,
  type PollInteractionType,
} from "../lib/pollTypes";

interface Props {
  roomId: string;
  onLogout: () => void;
}

export function PollHubPage({ roomId, onLogout }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const [newType, setNewType] = useState<PollInteractionType>("multiple_choice");
  const [newTitle, setNewTitle] = useState("");

  const { data: items, isLoading, error } = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createInteraction(roomId, {
        type: newType,
        ...(newTitle.trim() ? { title: newTitle.trim() } : {}),
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["interactions", roomId] });
      window.location.hash = `#/rooms/${roomId}/polls/${created.id}/builder`;
    },
  });

  const polls = (items ?? []).filter((i) => isPollType(i.type));

  return (
    <HostShell title="Poll 管理" roomId={roomId} onLogout={onLogout}>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          載入失敗：{(error as Error).message}
        </div>
      ) : null}

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">建立新 Poll</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as PollInteractionType)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {POLL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="題目標題（選填）"
            className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {createMutation.isPending ? "建立中…" : "建立"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            房間內 Poll（{polls.length}）
          </h2>
        </header>
        <ul className="divide-y divide-slate-100">
          {isLoading ? (
            <li className="px-4 py-8 text-center text-sm text-slate-400">載入中…</li>
          ) : polls.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-slate-400">尚無 Poll</li>
          ) : (
            polls.map((poll) => (
              <li
                key={poll.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {poll.title ?? "未命名題目"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {poll.type} · {poll.status}
                    {poll.result_visible ? " · 結果已揭示" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SmallLink href={`#/rooms/${roomId}/polls/${poll.id}/builder`}>
                    編輯
                  </SmallLink>
                  <SmallLink href={`#/rooms/${roomId}/polls/${poll.id}/console`}>
                    控制台
                  </SmallLink>
                  <SmallLink href={`#/rooms/${roomId}/polls/${poll.id}/present`}>
                    投影
                  </SmallLink>
                  <SmallLink href={`#/rooms/${roomId}/polls/${poll.id}/answer`}>
                    參與者預覽
                  </SmallLink>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </HostShell>
  );
}

function SmallLink(props: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <a
      href={props.href}
      className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200"
    >
      {props.children}
    </a>
  );
}
