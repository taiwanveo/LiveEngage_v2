/** Screen 投影控制（開啟／複製／測試／全螢幕／跟隨工作台）。 */

import * as React from "react";
import { useState } from "react";
import {
  JoinShareCard,
  Modal,
  PresentIcon,
  ShareIcon,
  joinUrl,
} from "@liveengage/ui";
import type { useScreenControl } from "../lib/useScreenControl";

interface Props {
  sessionCode: string | null;
  sessionTitle: string | null;
  screen: ReturnType<typeof useScreenControl>;
}

export function ScreenControlPanel({
  sessionCode,
  sessionTitle,
  screen,
}: Props): React.JSX.Element {
  const [shareOpen, setShareOpen] = useState(false);
  const href = screen.buildScreenHref();

  const copyScreen = async (): Promise<void> => {
    if (!href) return;
    await navigator.clipboard.writeText(href);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {href ? (
          <button
            type="button"
            onClick={() => screen.openScreen()}
            className="le-btn-primary le-btn-present-compact"
          >
            <PresentIcon size={14} />
            <span>Screen</span>
          </button>
        ) : (
          <span className="le-btn-primary le-btn-present-compact pointer-events-none opacity-50">
            <PresentIcon size={14} />
            <span>Screen</span>
          </span>
        )}
        <button
          type="button"
          disabled={!href}
          onClick={() => void copyScreen()}
          className="le-btn-secondary le-btn-present-compact disabled:opacity-50"
          title="複製投影網址"
        >
          複製
        </button>
        <button
          type="button"
          onClick={() => screen.showTest(sessionTitle)}
          className="le-btn-secondary le-btn-present-compact"
          title="顯示測試畫面"
        >
          測試
        </button>
        <button
          type="button"
          onClick={() => screen.requestFullscreen()}
          className="le-btn-secondary le-btn-present-compact"
          title="同機 Screen 視窗全螢幕（跨裝置請按 F）"
        >
          全螢幕
        </button>
        <label className="flex cursor-pointer items-center gap-1 text-[10px] text-muted">
          <input
            type="checkbox"
            checked={screen.followEnabled}
            onChange={(e) => screen.setFollowEnabled(e.target.checked)}
            className="rounded"
          />
          跟隨工作台
        </label>
        {sessionCode ? (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="le-btn-secondary le-btn-present-compact"
          >
            <ShareIcon size={14} />
            <span>分享</span>
          </button>
        ) : null}
      </div>

      {sessionCode ? (
        <Modal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          title="分享加入資訊"
          showCloseButton={false}
        >
          <JoinShareCard
            variant="modal"
            code={sessionCode}
            joinUrl={joinUrl(sessionCode)}
            onClose={() => setShareOpen(false)}
          />
          {href ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted">投影連結（Screen）</p>
              <p className="mt-1 break-all font-mono text-[11px] text-body">{href}</p>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
