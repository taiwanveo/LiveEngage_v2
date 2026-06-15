/** Poll 列表與建立入口（S6-2）。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import { HubInteractionRowActions } from "../components/HubInteractionRowActions";
import { HostRoomHubBreadcrumb } from "../components/HostBreadcrumb";
import { HostShell } from "../components/HostShell";
import { canEditHostContent } from "../lib/auth";
import { createInteraction, deleteInteraction, listInteractions } from "../lib/interactionApi";
import { pollAction } from "../lib/pollApi";
import { presentAppUrl } from "../lib/presentUrl";
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
  const { showError, showSuccess, systemNoticeModal } = useSystemNotice();
  const editable = canEditHostContent();
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
      showError(formatUserFacingError(err, "刪除失敗"));
    },
  });

  const startMutation = useMutation({
    mutationFn: (pollId: string) => pollAction(pollId, "start"),
    onSuccess: () => {
      showSuccess("已開始");
      void queryClient.invalidateQueries({ queryKey: ["interactions", roomId] });
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "開始失敗，請稍後再試"));
    },
  });

  const stopMutation = useMutation({
    mutationFn: (pollId: string) => pollAction(pollId, "stop"),
    onSuccess: () => {
      showSuccess("已結束");
      void queryClient.invalidateQueries({ queryKey: ["interactions", roomId] });
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "結束失敗，請稍後再試"));
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
      showError(formatUserFacingError(err, "建立失敗"));
    },
  });

  const polls = (items ?? []).filter((i) => isPollType(i.type));

  useEffect(() => {
    if (error) showError(`載入失敗：${formatUserFacingError(error)}`);
  }, [error, showError]);

  return (
    <HostShell
      title="Poll 管理"
      roomId={roomId}
      onLogout={onLogout}
      activeNav="polls"
      breadcrumb={<HostRoomHubBreadcrumb roomId={roomId} currentLabel="Poll 管理" />}
    >
      {editable ? (
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
            className="le-btn-primary le-btn-sm !min-h-[42px] !px-5 !text-sm"
          >
            {createMutation.isPending ? "建立中…" : "建立"}
          </button>
        </div>
      </section>
      ) : null}

      <section className="le-card overflow-hidden">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            已建立Poll項目（{polls.length}）
          </h2>
        </header>
        <ul className="divide-y divide-border">
          {isLoading ? (
            <li className="px-4 py-8 text-center text-sm text-muted">載入中…</li>
          ) : polls.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted">尚無 Poll</li>
          ) : (
            polls.map((poll) => {
              const label = poll.title ?? "未命名題目";
              return (
                <li
                  key={poll.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted">
                      {interactionMetaLine(
                        poll.type,
                        poll.status,
                        poll.result_visible ? "結果已揭示" : undefined
                      )}
                    </p>
                  </div>
                  <HubInteractionRowActions
                    workbenchHref={`#/rooms/${roomId}/workbench/${poll.id}`}
                    editHref={`#/rooms/${roomId}/polls/${poll.id}/builder`}
                    presentHref={presentAppUrl(roomId, poll.id)}
                    title={label}
                    status={poll.status}
                    editable={editable}
                    canStart={editable}
                    startPending={
                      startMutation.isPending && startMutation.variables === poll.id
                    }
                    onStart={() => startMutation.mutate(poll.id)}
                    stopPending={
                      stopMutation.isPending && stopMutation.variables === poll.id
                    }
                    onStop={() => stopMutation.mutate(poll.id)}
                    canDelete={poll.status !== "active" && poll.status !== "locked"}
                    deletePending={deleteMutation.isPending}
                    deleteDisabledReason={
                      poll.status === "active" || poll.status === "locked"
                        ? "進行中的 Poll 須先結束後才能刪除"
                        : "刪除此 Poll"
                    }
                    onDelete={() => deleteMutation.mutate(poll.id)}
                  />
                </li>
              );
            })
          )}
        </ul>
      </section>
      {systemNoticeModal}
    </HostShell>
  );
}
