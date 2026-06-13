import * as React from "react";
import { useEffect, useState } from "react";
import { AuthCard } from "@liveengage/ui";
import { fetchSsoConfig, login, ssoAuthorizeUrl } from "../lib/authApi";
import { setAuthTokens } from "../lib/auth";
import { ApiException } from "../lib/api";

interface Props {
  onLoggedIn: () => void;
}

export function LoginPage({ onLoggedIn }: Props): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      setAuthTokens(res.access_token, res.refresh_token);
      onLoggedIn();
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.error.message);
      } else {
        setError("登入失敗（login failed）");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Host 控制台"
      subtitle="主持人入口 — 建立活動、控場 Poll、審核 Q&A"
      footer="登入後可建立活動、複製參與連結，並進入 Q&A 審核或 Poll 控場。"
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

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={loading} className="le-btn-primary w-full">
          {loading ? "登入中…（signing in）" : "登入（sign in）"}
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
    </AuthCard>
  );
}
