/** Poll / Quiz 管理列表列：固定五鍵精簡操作列。 */

import * as React from "react";
import {
  ListActionCompactDanger,
  ListActionCompactLink,
  ListActionCompactPrimary,
  ListActionCompactSecondary,
  PresentListAction,
} from "@liveengage/ui";
import type { InteractionStatus } from "../lib/pollTypes";

interface Props {
  workbenchHref: string;
  editHref: string;
  presentHref: string;
  title: string;
  status: InteractionStatus;
  editable: boolean;
  canStart: boolean;
  startPending?: boolean;
  onStart: () => void;
  canDelete: boolean;
  deletePending?: boolean;
  deleteDisabledReason?: string;
  onDelete: () => void;
}

function ActionPlaceholder({ label }: { label: string }): React.JSX.Element {
  return (
    <span
      className="le-btn-secondary le-btn-present-compact pointer-events-none invisible select-none"
      aria-hidden
    >
      {label}
    </span>
  );
}

export function HubInteractionRowActions({
  workbenchHref,
  editHref,
  presentHref,
  title,
  status,
  editable,
  canStart,
  startPending = false,
  onStart,
  canDelete,
  deletePending = false,
  deleteDisabledReason,
  onDelete,
}: Props): React.JSX.Element {
  const showStart = canStart && status !== "active";

  const handleDelete = (): void => {
    if (
      !window.confirm(`確定要刪除「${title}」？此動作無法復原。`)
    ) {
      return;
    }
    onDelete();
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <ListActionCompactPrimary href={workbenchHref}>工作台</ListActionCompactPrimary>

      {showStart ? (
        <ListActionCompactSecondary
          disabled={startPending}
          onClick={onStart}
        >
          {startPending ? "處理中…" : "開始"}
        </ListActionCompactSecondary>
      ) : (
        <ActionPlaceholder label="開始" />
      )}

      <PresentListAction href={presentHref} compact />

      <ListActionCompactLink href={editHref}>
        {editable ? "編輯" : "檢視"}
      </ListActionCompactLink>

      {editable ? (
        canDelete ? (
          <ListActionCompactDanger
            disabled={deletePending}
            title={deleteDisabledReason}
            onClick={handleDelete}
          >
            刪除
          </ListActionCompactDanger>
        ) : (
          <ListActionCompactDanger
            disabled
            title={deleteDisabledReason}
          >
            刪除
          </ListActionCompactDanger>
        )
      ) : (
        <ActionPlaceholder label="刪除" />
      )}
    </div>
  );
}
