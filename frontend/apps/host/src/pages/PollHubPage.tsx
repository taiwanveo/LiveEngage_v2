/** Poll 列表與建立入口（S6-2）。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSystemNotice } from "@liveengage/ui";
import { ApiException } from "../lib/api";
import { HostRoomHubBreadcrumb } from "../components/HostBreadcrumb";
import { HostShell } from "../components/HostShell";
import { createInteraction, deleteInteraction, listInteractions } from "../lib/interactionApi";
import {
  interactionMetaLine,
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
  const { showError, systemNoticeModal } = useSystemNotice();
  const [newType, setNewType] = useState<PollInteractionType>("multiple_choice");
  const [newTitle, setNewTitle] = useState("");

  const { data: items, isLoading, error } = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });

  const deleteMutation = useMutation({
    mutationFn: (pollId: string) => deleteInteraction(pollId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["interactions", roomId] }),
    onError: (err: unknown) => {
      showError(err instanceof ApiException ? err.error.message : "刪除失敗");
    },
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
    onError: (err: unknown) => {
      showError(err instanceof ApiException ? err.error.message : "建立失敗");
    },
  });

  const polls = (items ?? []).filter((i) => isPollType(i.type));

  useEffect(() => {
    if (error) showError(`載入失敗：${(error as Error).message}`);
  }, [error, showError]);

  return (
    <HostShell
      title="Poll 管理"
      roomId={roomId}
      onLogout={onLogout}
      activeNav="polls"
      breadcrumb={<HostRoomHubBreadcrumb roomId={roomId} currentLabel="Poll 管理" />}
    >
      <section className="le-card mb-8 p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">建立新 Poll</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as PollInteractionType)}
            className="le-input !w-auto min-w-[180px]"
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
            className="le-input min-w-[200px] flex-1"
          />
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="le-btn-primary !min-h-[42px]"
          >
            {createMutation.isPending ? "建立中…" : "建立"}
          </button>
        </div>
      </section>

      <section className="le-card overflow-hidden">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            房間內 Poll（{polls.length}）
          </h2>
        </header>
        <ul className="divide-y divide-border">
          {isLoading ? (
            <li className="px-4 py-8 text-center text-sm text-muted">載入中…</li>
          ) : polls.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted">尚無 Poll</li>
          ) : (
            polls.map((poll) => (
              <li
                key={poll.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {poll.title ?? "未命名題目"}
                  </p>
                  <p className="text-xs text-muted">
                    {interactionMetaLine(
                      poll.type,
                      poll.status,
                      poll.result_visible ? "結果已揭示" : undefined
                    )}
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
                  <button
                    type="button"
                    disabled={poll.status === "active" || deleteMutation.isPending}
                    title={
                      poll.status === "active"
                        ? "進行中的 Poll 須先停止後才能刪除"
                        : "刪除此 Poll"
                    }
                    onClick={() => {
                      if (
                        !window.confirm(
                          `確定要刪除「${poll.title ?? "未命名題目"}」？此動作無法復原。`
                        )
                      ) {
                        return;
                      }
                      deleteMutation.mutate(poll.id);
                    }}
                    className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:hover:bg-red-950/40"
                  >
                    刪除
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
      {systemNoticeModal}
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
      className="le-btn-secondary !min-h-0 px-2.5 py-1 text-xs"
    >
      {props.children}
    </a>
  );
}
