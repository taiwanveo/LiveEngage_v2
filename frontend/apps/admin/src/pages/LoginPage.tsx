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
    <main className="flex min-h-full items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-xl"
      >
        <header>
          <h1 className="text-2xl font-bold text-slate-900">LiveEngage 管理後台</h1>
          <p className="mt-1 text-sm text-slate-500">組織管理員入口（admin portal）</p>
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

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 py-2 font-medium text-white transition-colors hover:bg-primary-700 disabled:bg-slate-400"
        >
          {loading ? "登入中…" : "登入（sign in）"}
        </button>
      </form>
    </main>
  );
}
