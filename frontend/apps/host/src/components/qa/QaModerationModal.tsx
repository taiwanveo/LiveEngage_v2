/** 工作台 Q&A 即時審核 Modal。 */

import * as React from "react";
import { Modal, PresentButton } from "@liveengage/ui";
import { QaControlBar } from "../QaControlBar";
import { QaModerationPanel } from "./QaModerationPanel";
import { qaPresentUrl } from "../../lib/presentUrl";

interface Props {
  roomId: string;
  open: boolean;
  onClose: () => void;
}

export function QaModerationModal({ roomId, open, onClose }: Props): React.JSX.Element {
  return (
    <Modal open={open} onClose={onClose} title="Q&A 即時問題" size="md">
      <div className="max-h-[70vh] space-y-4 overflow-y-auto">
        <QaControlBar roomId={roomId} />
        <QaModerationPanel roomId={roomId} compact disableWs />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <PresentButton href={qaPresentUrl(roomId)} compact />
        <a
          href={`#/rooms/${roomId}/moderation`}
          className="le-btn-secondary !min-h-[36px] !text-xs"
          onClick={onClose}
        >
          前往 Q&A 審核頁
        </a>
      </div>
    </Modal>
  );
}
