/** Screen App 入口。 */

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isThemeId, sanitizeScreenColor } from "@liveengage/ui";
import { getScreenToken, parseHashQuery, parseScreenTokenPayload } from "./lib/screenAuth";
import { resolveSessionByCode } from "./lib/screenApi";
import { useScreenDisplay, useScreenFullscreen } from "./hooks/useScreenDisplay";
import { ScreenRouter } from "./views/ScreenRouter";

export interface ScreenContext {
  roomId: string;
  sessionId: string;
}

export function App(): React.JSX.Element {
  const params = useMemo(() => parseHashQuery(), []);
  const token = getScreenToken();
  const tokenPayload = useMemo(
    () => (token ? parseScreenTokenPayload(token) : null),
    [token]
  );

  const eventCode = params.get("event")?.toUpperCase() ?? null;
  const roomFromUrl = params.get("room");
  const roomFromToken = tokenPayload?.room_id ?? null;
  const sessionFromToken = tokenPayload?.session_id ?? null;

  const [sessionId, setSessionId] = useState<string | null>(sessionFromToken);
  const [roomId, setRoomId] = useState<string | null>(roomFromUrl ?? roomFromToken);

  const needsCodeLookup = Boolean(eventCode && !roomFromUrl && !roomFromToken);

  const codeQuery = useQuery({
    queryKey: ["session-by-code", eventCode],
    queryFn: () => resolveSessionByCode(eventCode!),
    enabled: needsCodeLookup,
  });

  useEffect(() => {
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }
  }, [roomFromUrl]);

  useEffect(() => {
    if (roomFromToken) {
      setRoomId(roomFromToken);
    }
  }, [roomFromToken]);

  useEffect(() => {
    if (sessionFromToken) {
      setSessionId(sessionFromToken);
    }
  }, [sessionFromToken]);

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

  if (needsCodeLookup && codeQuery.isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">
        解析活動代碼…
      </main>
    );
  }

  if (needsCodeLookup && codeQuery.isError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-red-300">
        找不到活動代碼 {eventCode}
      </main>
    );
  }

  if (!roomId) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-6 text-center text-slate-400">
        <div>
          <p>
            無法取得投影房間。請確認 URL 含有 <code className="text-sky-400">room=</code> 或有效的{" "}
            <code className="text-sky-400">token=</code>。
          </p>
          {eventCode ? (
            <p className="mt-3 text-sm text-slate-500">
              僅有活動代碼無法啟動投影，請由主持端重新開啟 Screen 連結。
            </p>
          ) : null}
        </div>
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
