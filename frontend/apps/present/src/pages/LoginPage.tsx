import * as React from "react";
import { useState } from "react";
import { AuthCard, useSystemNotice } from "@liveengage/ui";
import { login } from "../lib/authApi";
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
      appTagline="投影展示（present）"
      title="投影展示"
      subtitle="大螢幕展示端 — 全場即時呈現 Poll 結果"
      footer="登入後選擇活動與 Poll 即可投影到大螢幕。"
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
      </form>
    </AuthCard>
    {systemNoticeModal}
    </>
  );
}
