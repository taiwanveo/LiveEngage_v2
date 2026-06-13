import * as React from "react";
import { useState } from "react";
import { AuthCard } from "@liveengage/ui";
import { login } from "../lib/authApi";
import { setAccessToken } from "../lib/auth";
import { ApiException } from "../lib/api";

interface Props {
  onLoggedIn: () => void;
}

export function LoginPage({ onLoggedIn }: Props): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      setAccessToken(res.access_token);
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

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={loading} className="le-btn-primary w-full">
          {loading ? "登入中…" : "登入（sign in）"}
        </button>
      </form>
    </AuthCard>
  );
}
