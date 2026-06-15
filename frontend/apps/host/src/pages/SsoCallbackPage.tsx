/** SSO callback：以 ticket 換 JWT。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { formatUserFacingError } from "@liveengage/realtime";
import { exchangeSsoTicket } from "../lib/authApi";
import { setAuthTokens } from "../lib/auth";
import { useSystemNotice } from "@liveengage/ui";

interface Props {
  ticket: string;
  returnTo?: string | undefined;
  onLoggedIn: () => void;
}

export function SsoCallbackPage({
  ticket,
  returnTo,
  onLoggedIn,
}: Props): React.JSX.Element {
  const { showError, systemNoticeModal } = useSystemNotice();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void exchangeSsoTicket(ticket)
      .then((res) => {
        if (cancelled) return;
        setAuthTokens(res.access_token, res.refresh_token);
        onLoggedIn();
        window.location.hash = returnTo ? `#/${returnTo.replace(/^\//, "")}` : "#/dashboard";
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        showError(formatUserFacingError(err, "SSO 登入失敗，請稍後再試"));
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ticket, returnTo, onLoggedIn, showError]);

  return (
    <main className="le-page-bg flex min-h-full items-center justify-center px-4">
      <div className="le-card p-8 text-center">
        {failed ? (
          <button
            type="button"
            className="le-btn-secondary mt-4"
            onClick={() => {
              window.location.hash = "";
            }}
          >
            返回登入
          </button>
        ) : (
          <p className="text-muted">SSO 登入處理中…</p>
        )}
      </div>
      {systemNoticeModal}
    </main>
  );
}

export function parseSsoCallbackHash(): { ticket: string; returnTo?: string } | null {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw.startsWith("sso/callback")) return null;
  const q = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  const ticket = params.get("ticket");
  if (!ticket) return null;
  const returnTo = params.get("return_to") ?? undefined;
  return returnTo ? { ticket, returnTo } : { ticket };
}
