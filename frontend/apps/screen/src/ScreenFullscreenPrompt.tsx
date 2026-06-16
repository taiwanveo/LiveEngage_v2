/** F 鍵全螢幕 + Host postMessage 遙控（跨網域須使用者於投影視窗內點擊確認）。 */

import * as React from "react";
import { useCallback, useEffect, useState } from "react";

function enterFullscreen(): void {
  void document.documentElement.requestFullscreen?.().catch(() => {
    /* 瀏覽器可能拒絕（未在使用者手勢脈絡內） */
  });
}

export function ScreenFullscreenPrompt(): React.JSX.Element | null {
  const [open, setOpen] = useState(false);

  const dismiss = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "f" || e.key === "F") {
        enterFullscreen();
        setOpen(false);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onMessage = (e: MessageEvent): void => {
      if (e.data?.type === "screen:fullscreen") {
        setOpen(true);
      }
    };
    const onFullscreenChange = (): void => {
      if (document.fullscreenElement) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMessage);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-6">
      <div className="max-w-md rounded-xl border border-slate-600 bg-slate-900 p-6 text-center shadow-2xl">
        <p className="text-lg font-semibold text-white">進入全螢幕投影</p>
        <p className="mt-2 text-sm text-slate-400">
          瀏覽器安全限制：須在投影視窗內點擊確認，或由主持端按「全螢幕」後在此視窗操作。
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-500"
            onClick={() => {
              enterFullscreen();
              setOpen(false);
            }}
          >
            進入全螢幕
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
            onClick={dismiss}
          >
            取消
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-500">快捷鍵：F</p>
      </div>
    </div>
  );
}
