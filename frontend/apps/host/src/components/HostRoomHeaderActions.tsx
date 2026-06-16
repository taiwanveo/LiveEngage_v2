/** Host 房間頁右上角：Screen 投影控制。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { listSessions } from "../lib/sessionApi";
import { useScreenControl } from "../lib/useScreenControl";
import { ScreenControlPanel } from "./ScreenControlPanel";

interface Props {
  roomId: string;
  /** @deprecated 舊 Host 內嵌 present；保留參數相容，已改開 Screen */
  presentHref?: string | undefined;
  /** 與工作台共用同一 screen 實例，避免測試畫面被跟隨同步覆蓋 */
  screen?: ReturnType<typeof useScreenControl> | undefined;
}

export function HostRoomHeaderActions({ roomId, screen: screenProp }: Props): React.JSX.Element {
  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });

  const session = sessionsQuery.data?.find((s) => s.default_room_id === roomId) ?? null;
  const internalScreen = useScreenControl(roomId);
  const screen = screenProp ?? internalScreen;

  return (
    <ScreenControlPanel
      sessionCode={session?.code ?? null}
      sessionTitle={session?.title ?? null}
      screen={screen}
    />
  );
}
