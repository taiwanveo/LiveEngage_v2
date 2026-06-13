/** Participant SSO callback。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { joinWithSsoTicket } from "../lib/authApi";
import { ApiException } from "../lib/api";
import { setParticipantSession } from "../lib/participantAuth";

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
  const [error, setError] = useState<string | null>(null);

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
        setError(err instanceof ApiException ? err.error.message : "SSO 加入失敗");
      });
    return () => {
      cancelled = true;
    };
  }, [ticket, sessionId, sessionCode]);

  return (
    <main className="le-page-bg flex min-h-full items-center justify-center px-4">
      <div className="le-card p-8 text-center">
        {error ? (
          <>
            <p className="text-danger">{error}</p>
            <a href={`#/join/${sessionCode}`} className="mt-4 inline-block text-sm text-accent">
              返回
            </a>
          </>
        ) : (
          <p className="text-muted">SSO 登入處理中…</p>
        )}
      </div>
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
