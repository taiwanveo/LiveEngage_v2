/** Screen App 入口。 */

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isThemeId, sanitizeScreenColor } from "@liveengage/ui";
import { parseHashQuery, getScreenToken } from "./lib/screenAuth";
import { resolveSessionByCode } from "./lib/screenApi";
import { useScreenDisplay, useScreenFullscreen } from "./hooks/useScreenDisplay";
import { ScreenRouter } from "./views/ScreenRouter";

export interface ScreenContext {
  roomId: string;
  sessionId: string;
}

export function App(): React.JSX.Element {
  const params = useMemo(() => parseHashQuery(), []);
  const eventCode = params.get("event")?.toUpperCase() ?? null;
  const roomFromUrl = params.get("room");
  const token = getScreenToken();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(roomFromUrl);

  const codeQuery = useQuery({
    queryKey: ["session-by-code", eventCode],
    queryFn: () => resolveSessionByCode(eventCode!),
    enabled: Boolean(eventCode && !roomFromUrl),
  });

  useEffect(() => {
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }
  }, [roomFromUrl]);

  useEffect(() => {
    if (codeQuery.data) {
      setRoomId(codeQuery.data.default_room_id);
      setSessionId(codeQuery.data.id);
    }
  }, [codeQuery.data]);

  useEffect(() => {
    const theme = params.get("theme");
    if (theme && isThemeId(theme)) {
      document.documentElement.setAttribute("data-theme", theme);
    }
    const bg = sanitizeScreenColor(params.get("bg"));
    const fg = sanitizeScreenColor(params.get("fg"));
    if (bg) document.documentElement.style.setProperty("--le-screen-bg", bg);
    if (fg) document.documentElement.style.setProperty("--le-screen-fg", fg);
  }, [params]);

  useScreenFullscreen();

  const { state, connected, isLoading } = useScreenDisplay(roomId);

  if (!token) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-6 text-center text-slate-300">
        <div>
          <h1 className="text-xl font-semibold text-white">缺少 Screen token</h1>
          <p className="mt-3 text-sm text-slate-400">
            請由主持端開啟投影連結，或於 URL 加上 <code className="text-sky-400">token=</code> 參數。
          </p>
        </div>
      </main>
    );
  }

  if (eventCode && codeQuery.isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">
        解析活動代碼…
      </main>
    );
  }

  if (eventCode && codeQuery.isError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-red-300">
        找不到活動代碼 {eventCode}
      </main>
    );
  }

  if (!roomId) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">
        請提供 <code className="text-sky-400">event=</code> 或 <code className="text-sky-400">room=</code> 參數
      </main>
    );
  }

  const resolvedSessionId = sessionId ?? state?.session_id ?? "";

  return (
    <ScreenRouter
      roomId={roomId}
      sessionId={resolvedSessionId}
      state={state}
      connected={connected}
      isLoading={isLoading}
    />
  );
}
