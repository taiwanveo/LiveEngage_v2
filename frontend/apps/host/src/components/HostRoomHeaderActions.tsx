/** Host 房間頁右上角：分享（跨頁固定）；工作台可選投影。 */

import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { JoinShareCard, Modal, participantJoinUrl } from "@liveengage/ui";
import { listSessions } from "../lib/sessionApi";
import { presentAppUrl } from "../lib/presentUrl";

const BTN_SECONDARY =
  "inline-flex min-h-[28px] items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-[11px] font-medium text-accent hover:border-accent/40";
const BTN_PRIMARY =
  "inline-flex min-h-[28px] items-center gap-1 rounded-full border border-accent bg-accent px-2.5 text-[11px] font-semibold text-accent-fg hover:brightness-105";

interface Props {
  roomId: string;
  presentPollId?: string | undefined;
  presentMenu?: React.ReactNode;
}

export function HostRoomHeaderActions({
  roomId,
  presentPollId,
  presentMenu,
}: Props): React.JSX.Element {
  const [shareOpen, setShareOpen] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });

  const session = sessionsQuery.data?.find((s) => s.default_room_id === roomId) ?? null;
  const showPresent = Boolean(presentPollId);

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        {showPresent ? (
          <div className="inline-flex overflow-hidden rounded-full border border-accent">
            <button
              type="button"
              title="開啟投影視窗"
              onClick={() => {
                window.open(presentAppUrl(roomId, presentPollId!), "_blank", "noopener");
              }}
              className={`${BTN_PRIMARY} !rounded-none !border-0`}
            >
              <PresentIcon />
              投影
            </button>
            {presentMenu ? (
              <div className="flex items-center border-l border-accent/30 bg-accent px-0.5">
                {presentMenu}
              </div>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          disabled={!session}
          title={session ? "分享加入連結" : "載入活動資訊中…"}
          onClick={() => setShareOpen(true)}
          className={BTN_SECONDARY}
        >
          <ShareIcon />
          分享
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
            joinUrl={participantJoinUrl(session.code)}
            onClose={() => setShareOpen(false)}
          />
        </Modal>
      ) : null}
    </>
  );
}

function ShareIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51 15.42 17.49M15.41 6.51 8.59 10.49" />
    </svg>
  );
}

function PresentIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
