/** 依活動代碼加入（FE-001/002）：#/join/{code} */

import * as React from "react";
import { useEffect, useState } from "react";
import { formatUserFacingError } from "@liveengage/realtime";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getParticipantContext,
  setParticipantSession,
} from "../lib/participantAuth";
import { joinSession, resolveSessionByCode } from "../lib/sessionApi";
import { AUTH_INPUT_CLASS, BrandedAuthShell, useSystemNotice } from "@liveengage/ui";
import { fetchSsoConfig, ssoAuthorizeUrl } from "../lib/authApi";
import { fetchBrandingByCode } from "../lib/brandingApi";

interface Props {
  code: string;
}

export function JoinPage({ code }: Props): React.JSX.Element {
  const { showError, systemNoticeModal } = useSystemNotice();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  useEffect(() => {
    void fetchSsoConfig()
      .then((cfg) => setSsoEnabled(cfg.enabled))
      .catch(() => setSsoEnabled(false));
  }, []);

  const sessionQuery = useQuery({
    queryKey: ["session-by-code", code],
    queryFn: () => resolveSessionByCode(code),
  });

  const brandingQuery = useQuery({
    queryKey: ["participant-branding", code],
    queryFn: () => fetchBrandingByCode(code),
    enabled: Boolean(code),
  });

  const session = sessionQuery.data;

  useEffect(() => {
    const ctx = getParticipantContext();
    if (ctx && session && ctx.sessionId === session.id) {
      window.location.hash = "#/room";
    }
  }, [session]);

  useEffect(() => {
    if (sessionQuery.error) {
      showError(formatUserFacingError(sessionQuery.error, "無法載入活動資訊"));
    }
  }, [sessionQuery.error, showError]);

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("活動尚未載入");
      const payload: {
        passcode?: string;
        name?: string;
        email?: string;
        is_anonymous: boolean;
      } = { is_anonymous: isAnonymous };
      if (passcode.trim()) payload.passcode = passcode.trim();
      if (name.trim()) payload.name = name.trim();
      if (email.trim()) payload.email = email.trim();
      return joinSession(session.id, payload);
    },
    onSuccess: (res) => {
      if (!res.room_id) {
        showError("加入成功但缺少房間資訊");
        return;
      }
      setParticipantSession({
        participantToken: res.participant_token,
        sessionId: res.session_id,
        roomId: res.room_id,
        sessionCode: code,
        displayName: res.display_name,
      });
      window.location.hash = "#/room";
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "加入失敗，請稍後再試"));
    },
  });

  if (sessionQuery.isLoading) {
    return <CenteredMessage>正在查詢活動代碼…</CenteredMessage>;
  }

  if (sessionQuery.error) {
    return (
      <>
        <CenteredMessage>
          <a href="#/join" className="inline-block text-sm text-accent hover:underline">
            重新輸入代碼
          </a>
        </CenteredMessage>
        {systemNoticeModal}
      </>
    );
  }

  if (!session) {
    return <CenteredMessage>找不到活動</CenteredMessage>;
  }

  const needsPasscode = session.visibility === "passcode";
  const needsSso = session.visibility === "sso";
  const notLive = session.status !== "live";

  return (
    <>
      <BrandedAuthShell
        appTagline="參與者（participant）"
        title={session.title}
        subtitle={`狀態：${statusLabel(session.status)}`}
        branding={brandingQuery.data ?? null}
        footer={
          <a href="#/join" className="text-accent hover:underline">
            使用其他代碼
          </a>
        }
      >
        <p className="-mt-4 mb-2 font-mono text-xs text-muted">{session.code}</p>

        {notLive ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            活動尚未開始，請等待主持人開放後再試。
          </div>
        ) : needsSso && !ssoEnabled ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            此活動需 SSO 登入，但目前尚未啟用 SSO。請聯絡活動主持人。
          </div>
        ) : needsSso && ssoEnabled ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">此活動需使用組織 SSO 登入後才能加入。</p>
            <a
              href={ssoAuthorizeUrl("participant", `join/${code}`)}
              className="le-btn-primary w-full"
            >
              使用 SSO 登入
            </a>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              joinMutation.mutate();
            }}
          >
            {needsPasscode ? (
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-foreground">Passcode</span>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className={AUTH_INPUT_CLASS}
                  required
                />
              </label>
            ) : null}

            {session.require_name ? (
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-foreground">姓名</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={AUTH_INPUT_CLASS}
                  required
                />
              </label>
            ) : (
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-foreground">暱稱（選填）</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={AUTH_INPUT_CLASS}
                />
              </label>
            )}

            {session.require_email ? (
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-foreground">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={AUTH_INPUT_CLASS}
                  required
                />
              </label>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-accent"
              />
              匿名參與
            </label>

            <button
              type="submit"
              disabled={joinMutation.isPending}
              className="le-btn-primary w-full"
            >
              {joinMutation.isPending ? "加入中…" : "加入活動"}
            </button>
          </form>
        )}
      </BrandedAuthShell>
      {systemNoticeModal}
    </>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "live":
      return "進行中";
    case "draft":
      return "草稿";
    case "ended":
      return "已結束";
    case "archived":
      return "已封存";
    default:
      return status;
  }
}

function CenteredMessage(props: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <main className="le-page-bg flex min-h-full items-center justify-center px-4">
      <div className="le-card p-8 text-center text-muted">{props.children}</div>
    </main>
  );
}
