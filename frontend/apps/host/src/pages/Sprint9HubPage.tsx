/** Sprint 9 互動管理：Quiz / Ideas / Survey 建立與進入控制台。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import { HubInteractionRowActions } from "../components/HubInteractionRowActions";
import { HostRoomHubBreadcrumb } from "../components/HostBreadcrumb";
import { HostShell } from "../components/HostShell";
import { canEditHostContent } from "../lib/auth";
import { sprint9PresentUrl } from "../lib/presentUrl";
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
  const editable = canEditHostContent();
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
      window.location.hash = `#/rooms/${roomId}/workbench/${created.id}`;
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "建立失敗"));
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => updateInteractionStatus(id, "active"),
    onSuccess: () => {
      showSuccess("已開始");
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "開始失敗，請稍後再試"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInteraction(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["interactions", roomId] }),
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "刪除失敗"));
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
            className="le-btn-primary le-btn-sm !min-h-[42px] !px-5 !text-sm"
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
            {s9Items.map((item) => {
              const label = item.title ?? interactionTypeLabel(item.type);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted">
                      題型：{interactionTypeLabel(item.type)} · 狀態：
                      {interactionStatusLabel(item.status)}
                    </p>
                  </div>
                  <HubInteractionRowActions
                    workbenchHref={`#/rooms/${roomId}/workbench/${item.id}`}
                    editHref={`#/rooms/${roomId}/workbench/${item.id}`}
                    presentHref={sprint9PresentUrl(roomId, item.id)}
                    title={label}
                    status={item.status}
                    editable={editable}
                    canStart={editable}
                    startPending={startMutation.isPending}
                    onStart={() => startMutation.mutate(item.id)}
                    canDelete={item.status !== "active"}
                    deletePending={deleteMutation.isPending}
                    deleteDisabledReason={
                      item.status === "active"
                        ? `進行中的 ${interactionTypeLabel(item.type)} 須先結束後才能刪除`
                        : `刪除此 ${interactionTypeLabel(item.type)}`
                    }
                    onDelete={() => deleteMutation.mutate(item.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {systemNoticeModal}
    </HostShell>
  );
}
