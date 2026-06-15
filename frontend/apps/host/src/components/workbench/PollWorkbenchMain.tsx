/** Poll 工作台中欄：標題、編輯、刪除、投影預覽。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { Modal, useSystemNotice } from "@liveengage/ui";
import { PollRenderer, type PollDetail, type PollResults } from "@liveengage/renderers";
import { canEditHostContent } from "../../lib/auth";
import { deleteInteraction } from "../../lib/interactionApi";
import {
  pollTypeLabel,
} from "../../lib/pollTypes";
import { WorkbenchInteractionStatusBadge } from "./WorkbenchInteractionStatusBadge";
import { WorkbenchInteractionTitle } from "./WorkbenchInteractionTitle";

interface Props {
  roomId: string;
  poll: PollDetail;
  results: PollResults | null;
  onDeleted?: () => void;
}

export function PollWorkbenchMain({
  roomId,
  poll,
  results,
  onDeleted,
}: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, showSuccess, systemNoticeModal } = useSystemNotice();
  const editable = canEditHostContent();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = poll.status !== "active";
  const displayTitle = poll.title?.trim() || "未命名題目";

  const deleteMutation = useMutation({
    mutationFn: () => deleteInteraction(poll.id),
    onSuccess: () => {
      setDeleteOpen(false);
      showSuccess("題目已刪除");
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
      void qc.removeQueries({ queryKey: ["poll", poll.id] });
      void qc.removeQueries({ queryKey: ["poll-results", poll.id] });
      onDeleted?.();
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "刪除失敗"));
    },
  });

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">{pollTypeLabel(poll.type)}</p>
          <WorkbenchInteractionTitle
            roomId={roomId}
            interactionId={poll.id}
            title={poll.title}
            placeholder="未命名題目"
          />
          {poll.result_visible ? (
            <p className="mt-1 text-xs text-muted">結果已揭示</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <WorkbenchInteractionStatusBadge status={poll.status} />
          <div className="flex flex-wrap items-center justify-end gap-3">
          <a
            href={`#/rooms/${roomId}/polls/${poll.id}/builder`}
            className="le-btn-secondary !min-h-[36px] !text-xs"
          >
            編輯題目
          </a>
          {editable ? (
            <button
              type="button"
              className="text-xs text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canDelete || deleteMutation.isPending}
              title={
                canDelete
                  ? "刪除此題目"
                  : "進行中的 Poll 須先停止後才能刪除"
              }
              onClick={() => setDeleteOpen(true)}
            >
              刪除題目
            </button>
          ) : null}
          </div>
        </div>
      </div>
      <div className="le-card overflow-hidden p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">投影預覽</h3>
        <PollRenderer mode="present" poll={poll} results={results} />
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteOpen(false);
        }}
        title="刪除題目"
        size="sm"
        showCloseButton={false}
      >
        <p className="text-sm text-muted">
          確定要刪除「{displayTitle}」？此動作無法復原。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="le-btn-secondary !min-h-[36px]"
            disabled={deleteMutation.isPending}
            onClick={() => setDeleteOpen(false)}
          >
            取消
          </button>
          <button
            type="button"
            className="le-btn-danger !min-h-[36px]"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? "刪除中…" : "確認刪除"}
          </button>
        </div>
      </Modal>
      {systemNoticeModal}
    </>
  );
}
