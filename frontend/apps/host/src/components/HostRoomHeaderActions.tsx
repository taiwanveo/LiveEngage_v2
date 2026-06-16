/** Host 房間頁右上角：Screen 投影控制。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { listSessions } from "../lib/sessionApi";
import { useScreenControl } from "../lib/useScreenControl";
import { useHostRoomNavLiveState } from "../lib/useHostRoomNavLiveState";
import { ScreenControlPanel } from "./ScreenControlPanel";

interface Props {
  roomId: string;
  /** @deprecated 舊 Host 內嵌 present；保留參數相容，已改開 Screen */
  presentHref?: string | undefined;
  /** 工作台傳入共用實例，避免重複 hook／重複 Screen PUT */
  screen?: ReturnType<typeof useScreenControl> | undefined;
  /** 顯示投影主題下拉 */
  showScreenTheme?: boolean;
}

function ScreenControlPanelWithSession({
  roomId,
  screen,
  showScreenTheme = false,
}: {
  roomId: string;
  screen: ReturnType<typeof useScreenControl>;
  showScreenTheme?: boolean;
}): React.JSX.Element {
  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });
  const navLive = useHostRoomNavLiveState(roomId);

  const session = sessionsQuery.data?.find((s) => s.default_room_id === roomId) ?? null;

  return (
    <ScreenControlPanel
      sessionCode={session?.code ?? null}
      sessionTitle={session?.title ?? null}
      screen={screen}
      qaOpen={navLive.qaOpen}
      showScreenTheme={showScreenTheme}
    />
  );
}

function HostRoomHeaderActionsInner({ roomId }: { roomId: string }): React.JSX.Element {
  const screen = useScreenControl(roomId);
  return <ScreenControlPanelWithSession roomId={roomId} screen={screen} />;
}

export function HostRoomHeaderActions({
  roomId,
  screen: screenProp,
  showScreenTheme = false,
}: Props): React.JSX.Element {
  if (screenProp) {
    return (
      <ScreenControlPanelWithSession
        roomId={roomId}
        screen={screenProp}
        showScreenTheme={showScreenTheme}
      />
    );
  }
  return <HostRoomHeaderActionsInner roomId={roomId} />;
}
