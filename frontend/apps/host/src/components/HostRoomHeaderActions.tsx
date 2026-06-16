/** Host 房間頁右上角：投影（另開新視窗）＋分享。 */

import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  JoinShareCard,
  Modal,
  PresentButton,
  PresentIcon,
  ShareIcon,
  joinUrl,
} from "@liveengage/ui";
import { listSessions } from "../lib/sessionApi";

interface Props {
  roomId: string;
  /** 投影目標 URL（完整 URL，含 hash） */
  presentHref?: string | undefined;
}

export function HostRoomHeaderActions({
  roomId,
  presentHref,
}: Props): React.JSX.Element {
  const [shareOpen, setShareOpen] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });

  const session = sessionsQuery.data?.find((s) => s.default_room_id === roomId) ?? null;
  const shareTitle = session
    ? "分享加入連結"
    : sessionsQuery.isLoading
      ? "載入活動資訊中…"
      : "找不到此房間對應的活動";

  return (
    <>
      <div className="flex min-h-[1.75rem] flex-wrap items-center justify-end gap-1.5">
        {presentHref ? (
          <PresentButton href={presentHref} compact />
        ) : (
          <span
            className="le-btn-primary le-btn-present-compact pointer-events-none invisible"
            aria-hidden
          >
            <PresentIcon size={14} />
            <span>投影</span>
          </span>
        )}
        <button
          type="button"
          disabled={!session}
          title={shareTitle}
          onClick={() => setShareOpen(true)}
          className="le-btn-secondary le-btn-present-compact disabled:opacity-50"
        >
          <ShareIcon size={14} />
          <span>分享</span>
        </button>
      </div>

      {session ? (
        <Modal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          title="分享加入資訊"
          showCloseButton={false}
        >
          <JoinShareCard
            variant="modal"
            code={session.code}
            joinUrl={joinUrl(session.code)}
            onClose={() => setShareOpen(false)}
          />
        </Modal>
      ) : null}
    </>
  );
}
