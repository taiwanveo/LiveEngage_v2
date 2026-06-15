/** Sprint 9 互動管理：Quiz / Ideas / Survey 建立與進入控制台。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import { HubInteractionRowActions } from "../components/HubInteractionRowActions";
import {
  HubCreateCard,
  HUB_CREATE_BTN_CLASS,
  HUB_CREATE_INPUT_CLASS,
} from "../components/HubCreateCard";
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
  type InteractionSummary,
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

  const stopMutation = useMutation({
    mutationFn: (id: string) => updateInteractionStatus(id, "stopped"),
    onSuccess: () => {
      showSuccess("已結束");
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "結束失敗，請稍後再試"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInteraction(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["interactions", roomId] });
      const previous = qc.getQueryData<InteractionSummary[]>([
        "interactions",
        roomId,
      ]);
      if (previous) {
        qc.setQueryData(
          ["interactions", roomId],
          previous.filter((i) => i.id !== id)
        );
      }
      return { previous };
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["interactions", roomId] }),
    onError: (err: unknown, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(["interactions", roomId], context.previous);
      }
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
      <HubCreateCard title="新增 Quiz">
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as typeof newType)}
          className={`${HUB_CREATE_INPUT_CLASS} !w-auto min-w-[140px]`}
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
          className={`${HUB_CREATE_INPUT_CLASS} min-w-[160px] flex-1`}
        />
        <button
          type="button"
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className={HUB_CREATE_BTN_CLASS}
        >
          {createMutation.isPending ? "建立中…" : "建立"}
        </button>
      </HubCreateCard>

      <section className="le-card overflow-hidden">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            已建立Quiz項目（{s9Items.length}）
          </h2>
        </header>
        <ul className="divide-y divide-border">
          {isLoading ? (
            <li className="px-4 py-8 text-center text-sm text-muted">載入中…</li>
          ) : s9Items.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted">尚無 Quiz</li>
          ) : (
            s9Items.map((item) => {
              const label = item.title ?? interactionTypeLabel(item.type);
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
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
                    startPending={
                      startMutation.isPending && startMutation.variables === item.id
                    }
                    onStart={() => startMutation.mutate(item.id)}
                    stopPending={
                      stopMutation.isPending && stopMutation.variables === item.id
                    }
                    onStop={() => stopMutation.mutate(item.id)}
                    canDelete={item.status !== "active" && item.status !== "locked"}
                    deletePending={
                      deleteMutation.isPending &&
                      deleteMutation.variables === item.id
                    }
                    deleteDisabledReason={
                      item.status === "active" || item.status === "locked"
                        ? `進行中的 ${interactionTypeLabel(item.type)} 須先結束後才能刪除`
                        : `刪除此 ${interactionTypeLabel(item.type)}`
                    }
                    onDelete={() => deleteMutation.mutate(item.id)}
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
