/** Screen App 入口。 */

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_THEME, applyScreenThemePrefs, isThemeId, sanitizeScreenColor } from "@liveengage/ui";
import { ScreenBrandingRoot } from "./components/ScreenBrandingRoot";
import { ScreenThemeListener } from "./components/ScreenThemeListener";
import { clearScreenToken, getScreenToken, parseHashQuery, parseScreenTokenPayload, setScreenToken } from "./lib/screenAuth";
import { resolveSessionByCode } from "./lib/screenApi";
import { ScreenFullscreenPrompt } from "./ScreenFullscreenPrompt";
import { useScreenDisplay } from "./hooks/useScreenDisplay";
import { ScreenRouter } from "./views/ScreenRouter";

export interface ScreenContext {
  roomId: string;
  sessionId: string;
}

export function App(): React.JSX.Element {
  const [params, setParams] = useState<URLSearchParams>(() => parseHashQuery());
  const [token, setToken] = useState<string | null>(() => getScreenToken());
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  // 監聽 URL 變化（例如在網址列直接貼上或替換參數）
  useEffect(() => {
    const handleUrlChange = () => {
      const p = parseHashQuery();
      setParams(p);
      setToken(getScreenToken());
    };
    window.addEventListener("hashchange", handleUrlChange);
    window.addEventListener("popstate", handleUrlChange);
    return () => {
      window.removeEventListener("hashchange", handleUrlChange);
      window.removeEventListener("popstate", handleUrlChange);
    };
  }, []);

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
    if (codeQuery.data?.id) {
      setSessionId(codeQuery.data.id);
    }
  }, [codeQuery.data?.id]);

  useEffect(() => {
    const themeParam = params.get("theme");
    const theme = themeParam && isThemeId(themeParam) ? themeParam : DEFAULT_THEME;
    applyScreenThemePrefs({
      theme,
      bg: sanitizeScreenColor(params.get("bg")),
      fg: sanitizeScreenColor(params.get("fg")),
    });
  }, [params]);

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = pasteInput.trim();
    if (!raw) return;

    let extractedToken: string | null = null;
    let extractedRoom: string | null = null;
    let extractedTheme: string | null = null;

    try {
      const matchToken = raw.match(/[?&#]token=([^&#\s]+)/);
      if (matchToken && matchToken[1]) {
        extractedToken = decodeURIComponent(matchToken[1]);
      }
      const matchRoom = raw.match(/[?&#]room=([^&#\s]+)/);
      if (matchRoom && matchRoom[1]) {
        extractedRoom = decodeURIComponent(matchRoom[1]);
      }
      const matchTheme = raw.match(/[?&#]theme=([^&#\s]+)/);
      if (matchTheme && matchTheme[1]) {
        extractedTheme = decodeURIComponent(matchTheme[1]);
      }
    } catch {
      // ignore
    }

    if (!extractedToken && raw.startsWith("eyJ") && raw.split(".").length === 3) {
      extractedToken = raw;
    }

    if (!extractedToken) {
      setPasteError("無法從輸入中識別出有效的 Token。請貼上完整的投影連結或以 eyJ 開頭的 JWT。");
      return;
    }

    const payload = parseScreenTokenPayload(extractedToken);
    if (!payload) {
      setPasteError("Token 格式無效或不是 Screen 權杖。請確認是否由主控台取得。");
      return;
    }

    setPasteError(null);
    setScreenToken(extractedToken);
    setToken(extractedToken);

    const room = extractedRoom || payload.room_id;
    if (room) {
      setRoomId(room);
    }
    if (payload.session_id) {
      setSessionId(payload.session_id);
    }

    try {
      const q = new URLSearchParams();
      if (room) q.set("room", room);
      q.set("token", extractedToken);
      if (extractedTheme) q.set("theme", extractedTheme);
      window.location.hash = `#/?${q.toString()}`;
    } catch {
      // ignore
    }
  };

  const { state, connected, isLoading } = useScreenDisplay(roomId);
  const resolvedSessionId = sessionId ?? state?.session_id ?? null;

  let content: React.JSX.Element;

  if (!token) {
    content = (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-6 py-12 text-slate-300">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-center text-xl font-bold text-white">LiveEngage 大螢幕投影</h1>
          <p className="mt-2 text-center text-sm text-slate-400">
            尚未帶入投影權杖 (Screen Token)。請由主持端開啟投影連結，或直接在下方貼上投影連結：
          </p>

          <form onSubmit={handlePasteSubmit} className="mt-6 space-y-3">
            <div>
              <input
                type="text"
                placeholder="貼上完整投影連結或 token=..."
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              {pasteError && (
                <p className="mt-2 text-xs text-rose-400">{pasteError}</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 active:scale-[0.99]"
            >
              進入投影畫面
            </button>
          </form>

          <div className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-500 leading-relaxed">
            💡 提示：若使用通訊軟體（如 LINE 或 Messenger）傳送，部分軟體可能會截斷網址後方的參數。您可以複製完整網址貼於上方輸入框即可正常使用。
          </div>
        </div>
      </main>
    );
  } else if (needsCodeLookup && codeQuery.isLoading) {
    content = (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">
        解析活動代碼…
      </main>
    );
  } else if (needsCodeLookup && codeQuery.isError) {
    content = (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-red-300">
        找不到活動代碼 {eventCode}
      </main>
    );
  } else if (!roomId) {
    content = (
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
  } else {
    content = (
      <>
        <ScreenFullscreenPrompt />
        <ScreenRouter
          roomId={roomId}
          sessionId={resolvedSessionId ?? ""}
          state={state}
          connected={connected}
          isLoading={isLoading}
        />
      </>
    );
  }

  return (
    <ScreenBrandingRoot sessionId={resolvedSessionId}>
      <ScreenThemeListener />
      {content}
    </ScreenBrandingRoot>
  );
}
