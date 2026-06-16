/** PM-002 審核 UI：pending / approved / answered 三欄。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { HostRoomHubBreadcrumb } from "../components/HostBreadcrumb";
import { HostShell } from "../components/HostShell";
import { QaControlBar } from "../components/QaControlBar";
import { QaModerationPanel } from "../components/qa/QaModerationPanel";
import { qaPresentUrl } from "../lib/presentUrl";
import { listSessions } from "../lib/sessionApi";
import { useScreenControl } from "../lib/useScreenControl";

interface Props {
  roomId: string;
  onLogout: () => void;
}

export function ModerationPage({ roomId, onLogout }: Props): React.JSX.Element {
  const validRoom = roomId !== "_" && roomId.length > 0;
  const screen = useScreenControl(roomId);

  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
    enabled: validRoom,
  });
  const session =
    sessionsQuery.data?.find((s) => s.default_room_id === roomId) ?? null;

  if (!validRoom) {
    return <RoomPicker onLogout={onLogout} />;
  }

  return (
    <HostShell
      title="Q&A 審核"
      roomId={roomId}
      onLogout={onLogout}
      activeNav="moderation"
      presentHref={qaPresentUrl(roomId)}
      screen={screen}
      breadcrumb={<HostRoomHubBreadcrumb roomId={roomId} currentLabel="Q&A 審核" />}
    >
      <QaControlBar roomId={roomId} sessionTitle={session?.title ?? null} screen={screen} />
      <QaModerationPanel roomId={roomId} />
    </HostShell>
  );
}

function RoomPicker(props: { onLogout: () => void }): React.JSX.Element {
  return (
    <main className="flex min-h-full items-center justify-center bg-slate-100 px-4">
      <div className="max-w-lg space-y-4 rounded-2xl bg-white p-8 text-center shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">請指定活動室（room）</h2>
        <p className="text-left text-sm leading-relaxed text-slate-600">
          請從活動列表選擇活動，或將網址中的佔位符換成實際 room ID：
        </p>
        <a
          href="#/dashboard"
          className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          前往活動列表
        </a>
        <code className="block break-all rounded bg-slate-100 px-3 py-2 font-mono text-xs text-slate-800">
          #/rooms/&lt;roomId&gt;/moderation
        </code>
        <button
          onClick={props.onLogout}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          登出
        </button>
      </div>
    </main>
  );
}
