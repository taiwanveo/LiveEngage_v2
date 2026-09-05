/** 工作台：編輯題目、刪除題目（工具列或標題列）。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { Modal, useSystemNotice } from "@liveengage/ui";
import { canEditHostContent } from "../../lib/auth";
import { deleteInteraction } from "../../lib/interactionApi";
import type { InteractionStatus } from "../../lib/pollTypes";

/** Quiz／Ideas／Survey 編輯區錨點 id（與各 Main 的 section id 一致）。 */
export const WORKBENCH_S9_EDIT_ID = "workbench-s9-edit";

const COMPACT_BTN =
  "inline-flex items-center rounded-full border border-border bg-background font-medium text-foreground transition hover:border-accent/30 hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50 min-h-[24px] px-2 py-0.5 text-[10px]";

const COMPACT_DELETE_BTN =
  "inline-flex items-center rounded-full border border-border bg-background font-medium text-danger transition hover:border-danger/30 hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50 min-h-[24px] px-2 py-0.5 text-[10px]";

interface Props {
  roomId: string;
  interactionId: string;
  status: InteractionStatus;
  displayTitle: string;
  /** Poll 等：導向 Builder */
  editHref?: string | undefined;
  /** Quiz／Ideas／Survey：捲動至編輯區 */
  editScrollTargetId?: string | undefined;
  onDeleted?: (() => void) | undefined;
  variant?: "default" | "compact";
}

export function WorkbenchInteractionActions({
  roomId,
  interactionId,
  status,
  displayTitle,
  editHref,
  editScrollTargetId,
  onDeleted,
  variant = "default",
}: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, showSuccess, systemNoticeModal } = useSystemNotice();
  const editable = canEditHostContent();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = status !== "active" && status !== "locked";
  const compact = variant === "compact";

  const deleteMutation = useMutation({
    mutationFn: () => deleteInteraction(interactionId),
    onSuccess: () => {
      setDeleteOpen(false);
      showSuccess("題目已刪除");
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
      onDeleted?.();
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "刪除失敗"));
    },
  });

  const scrollToEdit = (): void => {
    if (!editScrollTargetId) return;
    document.getElementById(editScrollTargetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const editClass = compact
    ? COMPACT_BTN
    : "le-btn-secondary !min-h-[36px] !text-xs";
  const deleteClass = compact
    ? COMPACT_DELETE_BTN
    : "text-xs text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <>
      <div
        className={
          compact
            ? "contents"
            : "flex flex-wrap items-center justify-end gap-3"
        }
      >
        {editHref ? (
          <a href={editHref} className={editClass} title="修改這道題目的內容或選項">
            編輯題目
          </a>
        ) : editScrollTargetId ? (
          <button type="button" onClick={scrollToEdit} className={editClass} title="修改這道題目的內容或選項">
            編輯題目
          </button>
        ) : null}
        {editable ? (
          <button
            type="button"
            className={deleteClass}
            disabled={!canDelete || deleteMutation.isPending}
            title={
              canDelete
                ? "刪除此題目"
                : "進行中的互動須先結束後才能刪除"
            }
            onClick={() => setDeleteOpen(true)}
          >
            刪除題目
          </button>
        ) : null}
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
