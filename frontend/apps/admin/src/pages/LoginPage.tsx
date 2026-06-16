import * as React from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatLoginError, fetchSiteBranding } from "@liveengage/realtime";
import {
  AUTH_INPUT_CLASS,
  BrandedAuthShell,
  LoginErrorBanner,
  onLoginFieldKeyDown,
  validateEmailPasswordLogin,
} from "@liveengage/ui";
import { fetchSsoConfig, login, ssoAuthorizeUrl } from "../lib/authApi";
import { setAuthTokens } from "../lib/auth";

interface Props {
  onLoggedIn: () => void;
}

export function LoginPage({ onLoggedIn }: Props): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
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

  function clearFormError(): void {
    setFormError(null);
  }

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (loading) return;

    const validationError = validateEmailPasswordLogin(email, password);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      setAuthTokens(res.access_token, res.refresh_token);
      onLoggedIn();
    } catch (err) {
      setFormError(formatLoginError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <BrandedAuthShell
      appTagline="管理後台（admin）"
      title="管理後台"
      subtitle="帳號管理、組織設定、系統日誌資料查詢與匯出"
      branding={brandingQuery.data ?? null}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFormError();
            }}
            onKeyDown={(e) => onLoginFieldKeyDown(e, loading)}
            className={AUTH_INPUT_CLASS}
            autoComplete="email"
            aria-invalid={formError ? true : undefined}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">密碼</span>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFormError();
            }}
            onKeyDown={(e) => onLoginFieldKeyDown(e, loading)}
            className={AUTH_INPUT_CLASS}
            autoComplete="current-password"
            aria-invalid={formError ? true : undefined}
          />
        </label>

        <LoginErrorBanner message={formError} />

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
  );
}
