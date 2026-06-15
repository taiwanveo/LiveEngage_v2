/** Q&A 審核頁：開啟／關閉 Q&A（參與者提問開關）。 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import {
  createInteraction,
  findLatestQaInteraction,
  listInteractions,
  updateInteraction,
  updateInteractionStatus,
} from "../lib/interactionApi";
import { interactionStatusLabel } from "../lib/pollTypes";

interface Props {
  roomId: string;
}

function isModerationEnabled(settings: Record<string, unknown> | undefined): boolean {
  return settings?.moderation_enabled === true;
}

export function QaControlBar({ roomId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();

  const interactionsQuery = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });

  const qa = findLatestQaInteraction(interactionsQuery.data ?? []);
  const isOpen = qa?.status === "active";
  const moderationEnabled = isModerationEnabled(qa?.settings);

  const openMutation = useMutation({
    mutationFn: async () => {
      let qaId = qa?.id;
      if (!qaId) {
        const created = await createInteraction(roomId, {
          type: "qa",
          title: "Q&A",
          settings: { moderation_enabled: true, downvote_enabled: true },
        });
        qaId = created.id;
      }
      return updateInteractionStatus(qaId, "active");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["interactions", roomId] }),
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "開啟 Q&A 失敗，請稍後再試"));
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => updateInteractionStatus(qa!.id, "stopped"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["interactions", roomId] }),
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "關閉 Q&A 失敗，請稍後再試"));
    },
  });

  const moderationMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateInteraction(qa!.id, {
        settings: { ...qa!.settings, moderation_enabled: enabled },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["interactions", roomId] }),
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "切換審核失敗，請稍後再試"));
    },
  });

  const pending =
    openMutation.isPending ||
    closeMutation.isPending ||
    moderationMutation.isPending;

  return (
    <section className="le-card mb-4 px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold leading-tight text-foreground">Q&A 提問</h2>
            {interactionsQuery.isLoading ? (
              <span className="text-xs text-muted">載入中…</span>
            ) : isOpen ? (
              <span className="le-badge le-badge-live !py-0.5 !text-[10px]">已開啟</span>
            ) : (
              <span className="le-badge bg-muted/20 !py-0.5 !text-[10px] text-muted">已關閉</span>
            )}
            {qa && !interactionsQuery.isLoading ? (
              moderationEnabled ? (
                <span className="le-badge bg-accent/15 !py-0.5 !text-[10px] text-accent">
                  審核已開啟
                </span>
              ) : (
                <span className="le-badge bg-muted/20 !py-0.5 !text-[10px] text-muted">
                  審核已關閉
                </span>
              )
            ) : null}
          </div>
          <p className="text-[11px] leading-snug text-muted">
            {isOpen
              ? moderationEnabled
                ? "參與者可以送出問題；新問題會出現在下方「待審」欄。"
                : "參與者可以送出問題；新問題會直接進入「已核准」並顯示給所有人。"
              : "參與者目前無法提問。請先開啟 Q&A，觀眾才能在參與者 App 的 Q&A 分頁送出問題。"}
            {!isOpen && !interactionsQuery.isLoading ? (
              <span className="text-warning"> 開啟 Q&A 會結束同室其他進行中的 Poll／Quiz。</span>
            ) : null}
          </p>
          {qa && !isOpen ? (
            <p className="text-[10px] leading-snug text-muted">
              上次狀態：{interactionStatusLabel(qa.status)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {qa ? (
            <button
              type="button"
              disabled={pending || interactionsQuery.isLoading}
              onClick={() => moderationMutation.mutate(!moderationEnabled)}
              className="le-btn-secondary !min-h-[30px] !px-3 !py-1 !text-xs"
            >
              {moderationMutation.isPending
                ? "更新中…"
                : moderationEnabled
                  ? "關閉審核"
                  : "開啟審核"}
            </button>
          ) : null}
          {isOpen ? (
            <button
              type="button"
              disabled={pending || !qa}
              onClick={() => closeMutation.mutate()}
              className="le-btn-secondary !min-h-[30px] !px-3 !py-1 !text-xs"
            >
              {closeMutation.isPending ? "關閉中…" : "關閉 Q&A"}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || interactionsQuery.isLoading}
              onClick={() => openMutation.mutate()}
              className="le-btn-primary !min-h-[30px] !px-3 !py-1 !text-xs"
            >
              {openMutation.isPending ? "開啟中…" : "開啟 Q&A"}
            </button>
          )}
        </div>
      </div>
      {systemNoticeModal}
    </section>
  );
}
