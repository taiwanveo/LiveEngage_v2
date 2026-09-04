import * as React from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatLoginError, fetchSiteBranding } from "@liveengage/realtime";
import {
  AUTH_INPUT_CLASS,
  BrandedAuthShell,
  LoginErrorBanner,
  ServerConfigTrigger,
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
      appTagline="主持人工作台（host）"
      title="活動主持工作台"
      subtitle="建立活動、編輯互動項目、主持活動"
      branding={brandingQuery.data ?? null}
      footer={
        <div className="flex justify-center">
          <ServerConfigTrigger />
        </div>
      }
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
            <a href={ssoAuthorizeUrl("host")} className="le-btn-secondary w-full">
              {ssoLabel}
            </a>
          </>
        ) : null}
      </form>
    </BrandedAuthShell>
  );
}
