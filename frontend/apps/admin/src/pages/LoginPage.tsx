import * as React from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUserFacingError, fetchSiteBranding } from "@liveengage/realtime";
import { AUTH_INPUT_CLASS, BrandedAuthShell, onLoginFieldKeyDown, useSystemNotice } from "@liveengage/ui";
import { fetchSsoConfig, login, ssoAuthorizeUrl } from "../lib/authApi";
import { setAuthTokens } from "../lib/auth";

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

  const brandingQuery = useQuery({
    queryKey: ["site-branding"],
    queryFn: fetchSiteBranding,
    staleTime: 60_000,
  });

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
    if (loading) return;
    setLoading(true);
    try {
      const res = await login(email, password);
      setAuthTokens(res.access_token, res.refresh_token);
      onLoggedIn();
    } catch (err) {
      showError(formatUserFacingError(err, "登入失敗，請檢查帳號密碼"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <BrandedAuthShell
        appTagline="管理後台（admin）"
        title="管理後台"
        subtitle="帳號管理、組織設定、稽核資料、匯出與品牌設定"
        branding={brandingQuery.data ?? null}
      >
        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => onLoginFieldKeyDown(e, loading)}
              className={AUTH_INPUT_CLASS}
              autoComplete="email"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">密碼</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => onLoginFieldKeyDown(e, loading)}
              className={AUTH_INPUT_CLASS}
              autoComplete="current-password"
            />
          </label>

          <button type="submit" disabled={loading} className="le-btn-primary w-full">
            {loading ? "登入中…" : "登入"}
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
      </BrandedAuthShell>
      {systemNoticeModal}
    </>
  );
}
