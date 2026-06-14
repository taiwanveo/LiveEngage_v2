import * as React from "react";
import { useEffect, useState } from "react";
import { AuthCard, useSystemNotice } from "@liveengage/ui";
import { fetchSsoConfig, login, ssoAuthorizeUrl } from "../lib/authApi";
import { setAuthTokens } from "../lib/auth";
import { ApiException } from "../lib/api";

interface Props {
  onLoggedIn: () => void;
}

export function LoginPage({ onLoggedIn }: Props): React.JSX.Element {
  const { showError, systemNoticeModal } = useSystemNotice();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoLabel, setSsoLabel] = useState("使用 SSO 登入");

  useEffect(() => {
    void fetchSsoConfig()
      .then((cfg) => {
        setSsoEnabled(cfg.enabled);
        setSsoLabel(cfg.label);
      })
      .catch(() => setSsoEnabled(false));
  }, []);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(email, password);
      setAuthTokens(res.access_token, res.refresh_token);
      onLoggedIn();
    } catch (err) {
      if (err instanceof ApiException) {
        showError(err.error.message);
      } else {
        showError("登入失敗（login failed）");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <AuthCard
      appTagline="管理後台（admin）"
      title="管理後台"
      subtitle="組織管理員入口 — 成員、稽核、匯出與品牌設定"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="le-input"
            autoComplete="email"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">密碼（password）</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="le-input"
            autoComplete="current-password"
          />
        </label>

        <button type="submit" disabled={loading} className="le-btn-primary w-full">
          {loading ? "登入中…" : "登入（sign in）"}
        </button>

        {ssoEnabled ? (
          <>
            <div className="relative py-1 text-center text-xs text-muted">
              <span className="bg-surface-elevated px-2">或</span>
            </div>
            <a href={ssoAuthorizeUrl("admin")} className="le-btn-secondary w-full">
              {ssoLabel}
            </a>
          </>
        ) : null}
      </form>
    </AuthCard>
    {systemNoticeModal}
    </>
  );
}
