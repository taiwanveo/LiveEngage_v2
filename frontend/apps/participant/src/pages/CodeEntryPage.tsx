/** 手動輸入活動代碼（導向 #/join/{code}）。 */

import * as React from "react";
import { useState } from "react";

export function CodeEntryPage(): React.JSX.Element {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    window.location.hash = `#/join/${trimmed}`;
  };

  return (
    <main className="flex min-h-full items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">加入活動</h1>
        <p className="mt-2 text-sm text-slate-600">
          輸入主持人提供的活動代碼（例如 ABC123）
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">活動代碼</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono tracking-widest"
              autoFocus
              required
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            繼續
          </button>
        </form>
      </div>
    </main>
  );
}
