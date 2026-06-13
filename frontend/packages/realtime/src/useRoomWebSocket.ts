/**
 * useRoomWebSocket — 管理與後端 /ws 端點的連線生命週期（P-4/P-WS-1）。
 *
 * 設計原則：
 *  - WS 只作廣播接收（鐵律 1）；業務寫入走 REST。
 *  - 斷線自動重連，指數退讓（1s → 最多 30s）。
 *  - 保存 lastEventId，重連時帶入 last_event_id 補送錯過事件。
 *  - onEvent 透過 ref 持有，不加入 effect deps；避免閉包陳舊問題。
 *  - 回傳 connected：供 UI 顯示連線狀態提示。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { WsEvent, WsMode } from "./types";

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export interface UseRoomWebSocketOptions {
  /** 目標房間 UUID；null 時不連線。 */
  roomId: string | null;
  /** JWT token（Host access token 或 Participant token）；null 時不連線。 */
  token: string | null;
  /** 連線身份模式，對應後端 WsMode。 */
  mode: WsMode;
  /** false 可臨時停用（預設 true）。 */
  enabled?: boolean;
  /** 每筆事件回呼；穩定引用，內部透過 ref 持有。 */
  onEvent: (event: WsEvent) => void;
}

export interface UseRoomWebSocketResult {
  /** 目前是否維持 OPEN 連線。 */
  connected: boolean;
}

export function useRoomWebSocket({
  roomId,
  token,
  mode,
  enabled = true,
  onEvent,
}: UseRoomWebSocketOptions): UseRoomWebSocketResult {
  const [connected, setConnected] = useState(false);

  // 以 ref 持有最新回呼，避免回呼變化觸發 re-connect
  const onEventRef = useRef<(event: WsEvent) => void>(onEvent);
  onEventRef.current = onEvent;

  // WS 實例
  const wsRef = useRef<WebSocket | null>(null);
  // 重連計時器
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 指數退讓毫秒數
  const backoffRef = useRef<number>(INITIAL_BACKOFF_MS);
  // 最後收到的事件 ID，用於重連 replay
  const lastEventIdRef = useRef<string | null>(null);
  // 是否「主動」關閉（unmount 或 deps 改變）——主動關閉不觸發重連
  const intentionalCloseRef = useRef(false);

  const connect = useCallback(() => {
    if (!roomId || !token) return;

    const params = new URLSearchParams({ token, room: roomId, mode });
    if (lastEventIdRef.current) {
      params.set("last_event_id", lastEventIdRef.current);
    }

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws?${params.toString()}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    intentionalCloseRef.current = false;

    ws.onopen = () => {
      setConnected(true);
      backoffRef.current = INITIAL_BACKOFF_MS;
    };

    ws.onmessage = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data as string) as WsEvent;
        // 回應 ping，保持連線
        if (data.type === "ping") {
          ws.send("pong");
          return;
        }
        // 記錄事件 ID 供 replay
        if (data.id) {
          lastEventIdRef.current = data.id;
        }
        onEventRef.current(data);
      } catch {
        // 忽略無法解析的訊息
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (intentionalCloseRef.current) return;

      // 指數退讓重連
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      timerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // error 後緊接 close，由 onclose 負責重連
    };
  }, [roomId, token, mode]);

  useEffect(() => {
    if (!enabled || !roomId || !token) return;

    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [connect, enabled, roomId, token]);

  return { connected };
}
