import * as React from "react";
import { useState } from "react";
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
    <main className="min-h-full flex items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 space-y-5"
      >
        <header>
          <h1 className="text-2xl font-bold text-slate-900">LiveEngage Host</h1>
          <p className="text-sm text-slate-500 mt-1">
            主持人入口（host portal）
          </p>
        </header>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">密碼（password）</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            autoComplete="current-password"
          />
        </label>

        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm border border-red-200"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white font-medium rounded-lg py-2 transition-colors"
        >
          {loading ? "登入中…（signing in）" : "登入（sign in）"}
        </button>

        <p className="text-xs text-slate-500 text-center">
          登入後請於網址列輸入 <code>#/rooms/&lt;roomId&gt;/moderation</code> 進入審核頁。
        </p>
      </form>
    </main>
  );
}
