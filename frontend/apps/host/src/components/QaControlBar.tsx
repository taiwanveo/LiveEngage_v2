/** Q&A 審核頁：開啟／關閉 Q&A（參與者提問開關）。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiException } from "../lib/api";
import {
  createInteraction,
  findLatestQaInteraction,
  listInteractions,
  updateInteractionStatus,
} from "../lib/interactionApi";
import { interactionStatusLabel } from "../lib/pollTypes";

interface Props {
  roomId: string;
}

export function QaControlBar({ roomId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const interactionsQuery = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });

  const qa = findLatestQaInteraction(interactionsQuery.data ?? []);
  const isOpen = qa?.status === "active";

  const openMutation = useMutation({
    mutationFn: async () => {
      let qaId = qa?.id;
      if (!qaId) {
        const created = await createInteraction(roomId, {
          type: "qa",
          title: "Q&A",
          settings: { moderation_enabled: true },
        });
        qaId = created.id;
      }
      return updateInteractionStatus(qaId, "active");
    },
    onMutate: () => setActionError(null),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["interactions", roomId] }),
    onError: (err: unknown) => {
      setActionError(
        err instanceof ApiException ? err.error.message : "開啟 Q&A 失敗，請稍後再試"
      );
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => updateInteractionStatus(qa!.id, "stopped"),
    onMutate: () => setActionError(null),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["interactions", roomId] }),
    onError: (err: unknown) => {
      setActionError(
        err instanceof ApiException ? err.error.message : "關閉 Q&A 失敗，請稍後再試"
      );
    },
  });

  const pending = openMutation.isPending || closeMutation.isPending;

  return (
    <section className="le-card mb-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Q&A 提問</h2>
            {interactionsQuery.isLoading ? (
              <span className="text-xs text-muted">載入中…</span>
            ) : isOpen ? (
              <span className="le-badge le-badge-live">已開啟</span>
            ) : (
              <span className="le-badge bg-muted/20 text-muted">已關閉</span>
            )}
          </div>
          <p className="text-xs text-muted">
            {isOpen
              ? "參與者可以送出問題；新問題會出現在下方「待審」欄（已啟用審核）。"
              : "參與者目前無法提問。請先開啟 Q&A，觀眾才能在參與者 App 的 Q&A 分頁送出問題。"}
          </p>
          {qa && !isOpen ? (
            <p className="text-[11px] text-muted">
              上次狀態：{interactionStatusLabel(qa.status)}
            </p>
          ) : null}
          {!isOpen && !interactionsQuery.isLoading ? (
            <p className="text-[11px] text-warning">
              開啟 Q&A 會結束同活動室內其他進行中的 Poll／Quiz 互動。
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {isOpen ? (
            <button
              type="button"
              disabled={pending || !qa}
              onClick={() => closeMutation.mutate()}
              className="le-btn-secondary !min-h-[36px] !text-xs"
            >
              {closeMutation.isPending ? "關閉中…" : "關閉 Q&A"}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || interactionsQuery.isLoading}
              onClick={() => openMutation.mutate()}
              className="le-btn-primary !min-h-[36px] !text-xs"
            >
              {openMutation.isPending ? "開啟中…" : "開啟 Q&A"}
            </button>
          )}
        </div>
      </div>
      {actionError ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
