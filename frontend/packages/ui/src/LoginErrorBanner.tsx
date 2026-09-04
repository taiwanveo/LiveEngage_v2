import * as React from "react";
import { useState } from "react";
import { LOGIN_ERROR_BANNER_CLASS } from "./loginForm";
import { ServerConfigModal } from "./ServerConfigModal";

export function LoginErrorBanner({
  message,
}: {
  message: string | null;
}): React.JSX.Element | null {
  const [configOpen, setConfigOpen] = useState(false);
  if (!message) return null;

  const isConnectionOr405 =
    message.includes("405") ||
    message.includes("無法連上伺服器") ||
    message.includes("API 伺服器");

  return (
    <>
      <div role="alert" aria-live="polite" className={LOGIN_ERROR_BANNER_CLASS}>
        <div>{message}</div>
        {isConnectionOr405 ? (
          <div className="mt-2 pt-2 border-t border-destructive/20 text-xs flex items-center justify-between">
            <span>可能是後端 API 伺服器網址未設定或已變更</span>
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              className="underline font-semibold hover:opacity-80"
            >
              ⚙️ 設定 API 伺服器
            </button>
          </div>
        ) : null}
      </div>
      <ServerConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
      />
    </>
  );
}
