/** Screen 投影控制（開啟／複製／測試／全螢幕／跟隨工作台）。 */

import * as React from "react";
import { useState } from "react";
import { formatUserFacingError } from "@liveengage/realtime";
import {
  JoinShareCard,
  Modal,
  PresentIcon,
  ScreenThemeSwitcher,
  ShareIcon,
  joinUrl,
  useSystemNotice,
} from "@liveengage/ui";
import type { useScreenControl } from "../lib/useScreenControl";

interface Props {
  sessionCode: string | null;
  sessionTitle: string | null;
  screen: ReturnType<typeof useScreenControl>;
  /** Q&A 是否已開啟（僅用於提示，不阻擋投影） */
  qaOpen?: boolean;
  /** 顯示投影主題下拉（工作台） */
  showScreenTheme?: boolean;
}

export function ScreenControlPanel({
  sessionCode,
  sessionTitle,
  screen,
  qaOpen = false,
  showScreenTheme = false,
}: Props): React.JSX.Element {
  const [shareOpen, setShareOpen] = useState(false);
  const { showError, showInfo, showSuccess, systemNoticeModal } = useSystemNotice();
  const href = screen.buildScreenHref();

  const copyScreen = async (): Promise<void> => {
    if (!href) return;
    await navigator.clipboard.writeText(href);
    showSuccess("已複製投影連結");
  };

  const handleTest = (): void => {
    screen.showTest(sessionTitle, {
      onSuccess: () => {
        showSuccess("投影已切換至測試畫面（大寫 TEST）");
      },
      onError: (err) => {
        showError(formatUserFacingError(err, "無法切換測試畫面"));
      },
    });
  };

  const handleQaProjection = (): void => {
    screen.showQa(sessionTitle);
    showSuccess("投影已切換至 Q&A 問題列表（熱門已核准問題）");
  };

  const handleFullscreen = (): void => {
    const result = screen.requestFullscreen();
    if (result === "no-window") {
      showInfo(
        "請先按「Screen」開啟投影視窗，再在投影視窗內點「進入全螢幕」或按 F 鍵。",
        "尚未開啟投影"
      );
      return;
    }
    showInfo("請在投影視窗點「進入全螢幕」，或按 F 鍵。", "已通知投影視窗");
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <div className="flex flex-col items-stretch gap-1.5">
          {href ? (
            <button
              type="button"
              onClick={() => {
                const win = screen.openScreen();
                if (!win) {
                  showInfo("若投影未開啟，請允許瀏覽器彈出視窗。", "開啟投影");
                }
              }}
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
          {showScreenTheme ? (
            <div title="切換投影畫面主題色彩">
              <ScreenThemeSwitcher
                compact
                prefs={screen.screenTheme.prefs}
                onChange={screen.screenTheme.setPrefs}
              />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!href || screen.updating}
          onClick={() => void copyScreen().catch(() => showError("複製失敗"))}
          className="le-btn-secondary le-btn-present-compact disabled:opacity-50"
          title="複製投影網址"
        >
          複製
        </button>
        <button
          type="button"
          disabled={screen.updating}
          onClick={handleQaProjection}
          className="le-btn-secondary le-btn-present-compact disabled:opacity-50"
          title={
            qaOpen
              ? "投影顯示熱門已核准問題"
              : "切換至 Q&A 問題列表（請至 Q&A 審核開啟提問後才有內容）"
          }
        >
          Q&A 投影
        </button>
        <button
          type="button"
          disabled={screen.updating}
          onClick={handleTest}
          className="le-btn-secondary le-btn-present-compact disabled:opacity-50"
          title="投影顯示 TEST 測試畫面，確認通道正常"
        >
          測試
        </button>
        <button
          type="button"
          onClick={handleFullscreen}
          className="le-btn-secondary le-btn-present-compact"
          title="通知投影視窗顯示全螢幕提示（須在投影視窗內點擊確認）"
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
      {systemNoticeModal}
    </>
  );
}
