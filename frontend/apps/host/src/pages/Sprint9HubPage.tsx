/** Sprint 9 互動管理：Quiz / Ideas / Survey 建立與進入控制台。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSystemNotice } from "@liveengage/ui";
import { HostRoomHubBreadcrumb } from "../components/HostBreadcrumb";
import { HostShell } from "../components/HostShell";
import { sprint9PresentUrl } from "../lib/presentUrl";
import { ApiException } from "../lib/api";
import {
  createInteraction,
  deleteInteraction,
  listInteractions,
  updateInteractionStatus,
} from "../lib/interactionApi";
import {
  interactionStatusLabel,
  interactionTypeLabel,
} from "../lib/pollTypes";

interface Props {
  roomId: string;
  onLogout: () => void;
}

const S9_TYPES = [
  { value: "quiz" as const, label: "快問快答" },
  { value: "ideas" as const, label: "點子牆" },
  { value: "survey" as const, label: "問卷" },
];

export function Sprint9HubPage({ roomId, onLogout }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [newType, setNewType] = useState<(typeof S9_TYPES)[number]["value"]>("quiz");
  const [title, setTitle] = useState("");
  const { showError, showSuccess, systemNoticeModal } = useSystemNotice();

  const { data: items, isLoading } = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createInteraction(roomId, {
        type: newType,
        ...(title.trim() ? { title: title.trim() } : {}),
      }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
      window.location.hash = `#/rooms/${roomId}/sprint9/${created.id}/console`;
    },
    onError: (err: unknown) => {
      showError(err instanceof ApiException ? err.error.message : "建立失敗");
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => updateInteractionStatus(id, "active"),
    onSuccess: () => {
      showSuccess("已開放");
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
    },
    onError: (err: unknown) => {
      showError(
        err instanceof ApiException ? err.error.message : "開放失敗，請稍後再試"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInteraction(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["interactions", roomId] }),
    onError: (err: unknown) => {
      showError(err instanceof ApiException ? err.error.message : "刪除失敗");
    },
  });

  const s9Items = (items ?? []).filter((i) =>
    ["quiz", "ideas", "survey"].includes(i.type)
  );

  return (
    <HostShell
      title="Quiz 管理"
      roomId={roomId}
      onLogout={onLogout}
      activeNav="sprint9"
      breadcrumb={<HostRoomHubBreadcrumb roomId={roomId} currentLabel="Quiz 管理" />}
    >
      <section className="le-card mb-8 p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">建立互動</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as typeof newType)}
            className="le-input !w-auto min-w-[180px]"
          >
            {S9_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="標題（選填）"
            className="le-input min-w-[200px] flex-1"
          />
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="le-btn-primary !min-h-[42px]"
          >
            建立
          </button>
        </div>
      </section>

      <section className="le-card overflow-hidden">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">已建立項目</h2>
        </header>
        {isLoading ? (
          <p className="px-6 py-8 text-sm text-muted">載入中…</p>
        ) : s9Items.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted">尚無 Quiz 互動</p>
        ) : (
          <ul className="divide-y divide-border">
            {s9Items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                <div>
                  <p className="font-medium text-foreground">
                    {item.title ?? interactionTypeLabel(item.type)}
                  </p>
                  <p className="text-xs text-muted">
                    題型：{interactionTypeLabel(item.type)} · 狀態：
                    {interactionStatusLabel(item.status)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.status !== "active" ? (
                    <button
                      type="button"
                      disabled={activateMutation.isPending}
                      onClick={() => activateMutation.mutate(item.id)}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      開放
                    </button>
                  ) : null}
                  <a
                    href={`#/rooms/${roomId}/sprint9/${item.id}/console`}
                    className="le-btn-secondary !min-h-0 px-3 py-1.5 text-xs"
                  >
                    控制台
                  </a>
                  {["quiz", "ideas", "survey"].includes(item.type) ? (
                    <a
                      href={sprint9PresentUrl(roomId, item.id)}
                      className="le-btn-primary !min-h-0 px-3 py-1.5 text-xs"
                    >
                      投影
                    </a>
                  ) : null}
                  {item.type === "quiz" ? (
                    <button
                      type="button"
                      disabled={item.status === "active" || deleteMutation.isPending}
                      title={
                        item.status === "active"
                          ? "進行中的 Quiz 須先結束後才能刪除"
                          : "刪除此 Quiz"
                      }
                      onClick={() => {
                        if (
                          !window.confirm(
                            `確定要刪除「${item.title ?? "快問快答"}」？此動作無法復原。`
                          )
                        ) {
                          return;
                        }
                        deleteMutation.mutate(item.id);
                      }}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:hover:bg-red-950/40"
                    >
                      刪除
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {systemNoticeModal}
    </HostShell>
  );
}
