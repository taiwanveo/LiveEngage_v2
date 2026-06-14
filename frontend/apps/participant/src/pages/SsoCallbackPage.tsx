/** Participant SSO callback。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { joinWithSsoTicket } from "../lib/authApi";
import { ApiException } from "../lib/api";
import { setParticipantSession } from "../lib/participantAuth";
import { useSystemNotice } from "@liveengage/ui";

interface Props {
  ticket: string;
  sessionId: string;
  sessionCode: string;
}

export function SsoCallbackPage({
  ticket,
  sessionId,
  sessionCode,
}: Props): React.JSX.Element {
  const { showError, systemNoticeModal } = useSystemNotice();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void joinWithSsoTicket(ticket, sessionId)
      .then((res) => {
        if (cancelled) return;
        setParticipantSession({
          participantToken: res.participant_token,
          sessionId: res.session_id,
          roomId: res.room_id,
          sessionCode,
          displayName: res.display_name,
        });
        window.location.hash = "#/room";
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        showError(err instanceof ApiException ? err.error.message : "SSO 加入失敗");
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ticket, sessionId, sessionCode, showError]);

  return (
    <main className="le-page-bg flex min-h-full items-center justify-center px-4">
      <div className="le-card p-8 text-center">
        {failed ? (
          <a href={`#/join/${sessionCode}`} className="inline-block text-sm text-accent">
            返回
          </a>
        ) : (
          <p className="text-muted">SSO 登入處理中…</p>
        )}
      </div>
      {systemNoticeModal}
    </main>
  );
}

export function parseParticipantSsoCallback():
  | { ticket: string; returnTo: string }
  | null {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw.startsWith("sso/callback")) return null;
  const q = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  const ticket = params.get("ticket");
  const returnTo = params.get("return_to") ?? "";
  if (!ticket) return null;
  return { ticket, returnTo };
}
