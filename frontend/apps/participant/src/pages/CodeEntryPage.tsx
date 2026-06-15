/** 手動輸入活動代碼（導向 #/join/{code}）。 */

import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSiteBranding } from "@liveengage/realtime";
import { AUTH_INPUT_CLASS, BrandedAuthShell } from "@liveengage/ui";

export function CodeEntryPage(): React.JSX.Element {
  const [code, setCode] = useState("");

  const brandingQuery = useQuery({
    queryKey: ["site-branding"],
    queryFn: fetchSiteBranding,
    staleTime: 60_000,
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    window.location.hash = `#/join/${trimmed}`;
  };

  return (
    <BrandedAuthShell
      appTagline="參與者（participant）"
      title="加入活動"
      subtitle="輸入主持人提供的活動代碼（例如 ABC123）"
      branding={brandingQuery.data ?? null}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-foreground">活動代碼</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className={`${AUTH_INPUT_CLASS} font-mono tracking-widest`}
            autoFocus
            required
          />
        </label>
        <button type="submit" className="le-btn-primary w-full">
          繼續
        </button>
      </form>
    </BrandedAuthShell>
  );
}
