/** Screen 投影控制（開啟／主題／Q&A／測試／複製／跟隨工作台）。 */

import * as React from "react";
import { useState } from "react";
import { formatUserFacingError } from "@liveengage/realtime";
import {
  JoinShareCard,
  Modal,
  PresentIcon,
  ShareIcon,
  joinUrl,
  useSystemNotice,
} from "@liveengage/ui";
import type { useScreenControl } from "../lib/useScreenControl";

interface Props {
  roomId: string;
  sessionCode: string | null;
  sessionTitle: string | null;
  screen: ReturnType<typeof useScreenControl>;
  /** Q&A 是否已開啟（僅用於提示，不阻擋投影） */
  qaOpen?: boolean;
}

export function ScreenControlPanel({
  roomId,
  sessionCode,
  sessionTitle,
  screen,
  qaOpen = false,
}: Props): React.JSX.Element {
  const [shareOpen, setShareOpen] = useState(false);
  const [testingProjection, setTestingProjection] = useState(false);
  const { showError, showInfo, showSuccess, systemNoticeModal } = useSystemNotice();
  const href = screen.buildScreenHref();
  const isStandbyProjected = screen.screenState?.view === "standby";

  const copyScreen = async (): Promise<void> => {
    if (!href) return;
    await navigator.clipboard.writeText(href);
    showSuccess("已複製投影網址");
  };

  const handleTestToggle = (): void => {
    if (testingProjection) {
      screen.showStandby(sessionTitle, {
        onSuccess: () => {
          setTestingProjection(false);
          showSuccess("已結束測試投影，切回待機畫面");
        },
        onError: (err) => {
          showError(formatUserFacingError(err, "無法結束測試投影"));
        },
      });
      return;
    }
    screen.showTest(sessionTitle, {
      onSuccess: () => {
        setTestingProjection(true);
        showSuccess("投影已切換至測試畫面（大寫 TEST）");
      },
      onError: (err) => {
        showError(formatUserFacingError(err, "無法切換測試畫面"));
      },
    });
  };

  const handleQaProjection = (): void => {
    screen.showQa(sessionTitle);
    window.location.hash = `#/rooms/${roomId}/moderation`;
    showSuccess("投影已切換至 Q&A 問題列表（熱門已核准問題）");
  };

  const handleOverviewProjection = (): void => {
    screen.showOverview(sessionTitle);
    showSuccess("投影已切換至即時總覽");
  };

  const handleStandbyProjection = (): void => {
    if (isStandbyProjected) {
      screen.showOverview(sessionTitle);
      showSuccess("已取消待機，切換至即時總覽");
      return;
    }
    screen.showStandby(sessionTitle, {
      onSuccess: () => {
        showSuccess("投影已切換至待機畫面");
      },
      onError: (err) => {
        showError(formatUserFacingError(err, "無法切換至待機畫面"));
      },
    });
  };

  const openThemedProjection = (theme: "dark" | "light"): void => {
    screen.screenTheme.setTheme(theme);
    const win = screen.openScreenWithTheme(theme);
    if (!win) {
      showInfo("若投影未開啟，請允許瀏覽器彈出視窗。", "開啟投影");
      return;
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-elevated/80 px-2 py-1">
          <button
            type="button"
            disabled={!href}
            onClick={() => openThemedProjection("dark")}
            className="le-btn-present-compact inline-flex items-center gap-1 rounded-full bg-primary-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
            title="以專業深色主題開啟投影"
          >
            <PresentIcon size={14} />
            <span>投影（深色）</span>
          </button>
          <button
            type="button"
            disabled={!href}
            onClick={() => openThemedProjection("light")}
            className="le-btn-present-compact inline-flex items-center gap-1 rounded-full border border-primary-600 bg-white px-2.5 py-1 text-[11px] font-semibold text-primary-700 transition hover:bg-primary-50 disabled:opacity-50"
            title="以專業淺色主題開啟投影"
          >
            <PresentIcon size={14} className="text-primary-700" />
            <span>投影（淺色）</span>
          </button>
          <button
            type="button"
            disabled={screen.updating}
            onClick={handleStandbyProjection}
            className="le-btn-secondary le-btn-present-compact disabled:opacity-50"
            title={
              isStandbyProjected
                ? "取消待機，切換至即時總覽"
                : "投影切換至待機畫面，暫不顯示互動項目"
            }
          >
            {isStandbyProjected ? "取消待機" : "待機畫面"}
          </button>
          <button
            type="button"
            disabled={screen.updating}
            onClick={handleOverviewProjection}
            className="le-btn-secondary le-btn-present-compact disabled:opacity-50"
            title="投影顯示即時總覽（參與者數、Q&A 數、Poll 數等）"
          >
            即時總覽
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
          <label
            className="flex cursor-pointer items-center gap-1 text-[10px] font-medium text-foreground"
            title="勾選後，投影畫面會自動跟隨工作台切換的題目"
          >
            <input
              type="checkbox"
              checked={screen.followEnabled}
              onChange={(e) => screen.setFollowEnabled(e.target.checked)}
              className="rounded"
            />
            跟隨工作台
          </label>
          <button
            type="button"
            disabled={!href || screen.updating}
            onClick={() => void copyScreen().catch(() => showError("複製失敗"))}
            className="le-btn-secondary le-btn-present-compact disabled:opacity-50"
            title="複製投影網址"
          >
            複製網址
          </button>
          <button
            type="button"
            disabled={screen.updating}
            onClick={handleTestToggle}
            className="le-btn-secondary le-btn-present-compact disabled:opacity-50"
            title={
              testingProjection
                ? "結束測試投影並回待機畫面"
                : "切到測試投影畫面，確認通道正常"
            }
          >
            {testingProjection ? "結束測試" : "測試投影"}
          </button>
        </div>
        {sessionCode ? (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="le-btn-secondary le-btn-present-compact"
            title="分享加入連結或 QR Code 給參與者"
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
