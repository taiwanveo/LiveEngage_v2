/** 手動輸入活動代碼（導向 #/join/{code}）。 */

import * as React from "react";
import { useState } from "react";
import { AppHeader } from "@liveengage/ui";

export function CodeEntryPage(): React.JSX.Element {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    window.location.hash = `#/join/${trimmed}`;
  };

  return (
    <main className="le-page-bg flex min-h-full flex-col">
      <AppHeader brand="LiveEngage" tagline="參與者（participant）" maxWidth="2xl" />

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="le-card-elevated w-full max-w-md p-8">
          <h1 className="font-display text-2xl font-bold text-foreground">加入活動</h1>
          <p className="mt-2 text-sm text-muted">
            輸入主持人提供的活動代碼（例如 ABC123）
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-foreground">活動代碼</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="le-input font-mono tracking-widest"
                autoFocus
                required
              />
            </label>
            <button type="submit" className="le-btn-primary w-full">
              繼續
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
