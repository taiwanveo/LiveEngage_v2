/** 參與者房間頁右上角：分享加入連結（與 Host 同位置）。 */

import * as React from "react";
import { useState } from "react";
import { JoinShareCard, Modal, participantJoinUrl } from "@liveengage/ui";

const BTN_SECONDARY =
  "inline-flex min-h-[28px] items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-[11px] font-medium text-accent hover:border-accent/40";

interface Props {
  sessionCode: string | null;
}

export function ParticipantShareActions({ sessionCode }: Props): React.JSX.Element | null {
  const [shareOpen, setShareOpen] = useState(false);

  if (!sessionCode) return null;

  return (
    <>
      <button
        type="button"
        title="分享加入連結"
        onClick={() => setShareOpen(true)}
        className={BTN_SECONDARY}
      >
        <ShareIcon />
        分享
      </button>

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="分享加入資訊"
        showCloseButton={false}
      >
        <JoinShareCard
          variant="modal"
          code={sessionCode}
          joinUrl={participantJoinUrl(sessionCode)}
          onClose={() => setShareOpen(false)}
        />
      </Modal>
    </>
  );
}

function ShareIcon(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51 15.42 17.49M15.41 6.51 8.59 10.49" />
    </svg>
  );
}
