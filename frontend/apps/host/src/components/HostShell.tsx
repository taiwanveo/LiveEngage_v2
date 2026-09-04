/** Host 頁面外殼：統一房間頂欄 + 內容區。 */

import * as React from "react";
import { AiConfigTrigger, HostRoomNavHeader } from "@liveengage/ui";
import type { HostRoomNavItem, HostRoomSessionMeta } from "@liveengage/ui";
import { HostRoomHeaderActions } from "./HostRoomHeaderActions";
import { useHostRoomSessionMeta } from "../lib/useHostRoomSessionMeta";
import {
  useHostRoomNavLiveState,
  type HostRoomNavLiveState,
} from "../lib/useHostRoomNavLiveState";
import type { useScreenControl } from "../lib/useScreenControl";

export type HostNavId = "workbench" | "overview" | "moderation" | "polls" | "sprint9";

export const HOST_DASHBOARD_HASH = "#/dashboard";

const HOST_NAV: { id: HostNavId; segment: string; label: string }[] = [
  { id: "workbench", segment: "workbench", label: "工作台" },
  { id: "overview", segment: "overview", label: "即時總覽" },
  { id: "moderation", segment: "moderation", label: "Q&A 審核" },
  { id: "polls", segment: "polls", label: "Poll 管理" },
  { id: "sprint9", segment: "sprint9", label: "Quiz 管理" },
];

export function hostRoomNavItems(
  roomId: string,
  activeNav?: HostNavId,
  live?: Pick<HostRoomNavLiveState, "qaOpen" | "pollRunning" | "quizRunning">
): HostRoomNavItem[] {
  return HOST_NAV.map((item) => ({
    href: `#/rooms/${roomId}/${item.segment}`,
    label: item.label,
    active: activeNav === item.id,
    liveIndicator:
      item.id === "moderation"
        ? Boolean(live?.qaOpen)
        : item.id === "polls"
          ? Boolean(live?.pollRunning)
          : item.id === "sprint9"
            ? Boolean(live?.quizRunning)
            : false,
  }));
}

interface HostShellProps {
  title: string;
  subtitle?: string;
  roomId: string;
  onLogout: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** 標題右側附加控制（與標題間隔約兩字元） */
  titleAddon?: React.ReactNode;
  activeNav?: HostNavId;
  /** 投影目標 URL（Poll / Q&A / Quiz） */
  presentHref?: string | undefined;
  /** 標題列下方麵包屑（固定於 header 內，捲動時仍可見） */
  breadcrumb?: React.ReactNode;
  /** 日期／代碼／活動名／狀態列（未傳入時依 roomId 自動解析） */
  sessionMeta?: HostRoomSessionMeta;
  /** 與頁面共用 Screen 控制實例（Q&A 開啟時同步投影等） */
  screen?: ReturnType<typeof useScreenControl>;
}

export function HostShell({
  title,
  subtitle,
  roomId,
  onLogout,
  children,
  actions,
  titleAddon,
  activeNav,
  presentHref,
  breadcrumb,
  sessionMeta,
  screen,
}: HostShellProps): React.JSX.Element {
  const defaultSessionMeta = useHostRoomSessionMeta(roomId);
  const navLive = useHostRoomNavLiveState(roomId);

  return (
    <main className="le-page-bg min-h-full">
      <HostRoomNavHeader
        title={title}
        brandHref={HOST_DASHBOARD_HASH}
        {...(titleAddon ? { brandAddon: titleAddon } : {})}
        {...(subtitle ? { tagline: subtitle } : {})}
        sessionMeta={sessionMeta ?? defaultSessionMeta}
        navItems={hostRoomNavItems(roomId, activeNav, navLive)}
        {...(actions ? { actions } : {})}
        headerActions={<AiConfigTrigger />}
        onLogout={onLogout}
        chromeFooterActions={
          <HostRoomHeaderActions
            roomId={roomId}
            {...(presentHref ? { presentHref } : {})}
            {...(screen ? { screen } : {})}
          />
        }
        {...(breadcrumb ? { subRow: breadcrumb } : {})}
      />
      <div className="relative z-10 mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">{children}</div>
    </main>
  );
}
