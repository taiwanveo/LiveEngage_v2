/** Host 房間頁右上角：投影（另開新視窗）＋分享。 */

import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  JoinShareCard,
  Modal,
  PresentButton,
  ShareIcon,
  participantJoinUrl,
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
      <div className="flex items-center justify-end gap-1.5">
        {presentHref ? <PresentButton href={presentHref} compact /> : null}
        <Button
          type="button"
          variant="secondary"
          size="xs"
          disabled={!session}
          title={shareTitle}
          onClick={() => setShareOpen(true)}
        >
          <ShareIcon size={14} />
          分享
        </Button>
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
            joinUrl={participantJoinUrl(session.code)}
            onClose={() => setShareOpen(false)}
          />
        </Modal>
      ) : null}
    </>
  );
}
