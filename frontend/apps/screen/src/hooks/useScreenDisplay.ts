/** 訂閱投影 display state（REST + WS screen_view_changed）。 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SCREEN_VIEW_CHANGED, useRoomWebSocket, type WsEvent } from "@liveengage/realtime";
import { getScreenState, type ScreenDisplayState } from "../lib/screenApi";
import { getScreenToken } from "../lib/screenAuth";

const BACKUP_MS = 10_000;

export function useScreenDisplay(roomId: string | null): {
  state: ScreenDisplayState | undefined;
  connected: boolean;
  isLoading: boolean;
} {
  const qc = useQueryClient();
  const token = getScreenToken();

  const query = useQuery({
    queryKey: ["screen-state", roomId],
    queryFn: () => getScreenState(roomId!),
    enabled: Boolean(roomId && token),
    refetchInterval: BACKUP_MS,
  });

  const handleWs = useCallback(
    (event: WsEvent) => {
      if (event.type !== SCREEN_VIEW_CHANGED || !roomId) return;
      const payload = event.payload as unknown as ScreenDisplayState;
      qc.setQueryData(["screen-state", roomId], payload);
    },
    [qc, roomId]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token,
    mode: "screen",
    enabled: Boolean(roomId && token),
    onEvent: handleWs,
  });

  return {
    state: query.data,
    connected,
    isLoading: query.isLoading,
  };
}
