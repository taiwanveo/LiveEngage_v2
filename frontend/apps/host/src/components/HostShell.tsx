import * as React from "react";
import { AppHeader } from "@liveengage/ui";
import { HostRoomHeaderActions } from "./HostRoomHeaderActions";
import { HostSessionMeta } from "./HostSessionMeta";

export type HostNavId = "overview" | "moderation" | "polls" | "sprint9";

export const HOST_DASHBOARD_HASH = "#/dashboard";

const HOST_NAV: { id: HostNavId; segment: string; label: string }[] = [
  { id: "overview", segment: "overview", label: "即時總覽" },
  { id: "moderation", segment: "moderation", label: "Q&A 審核" },
  { id: "polls", segment: "polls", label: "Poll 管理" },
  { id: "sprint9", segment: "sprint9", label: "Quiz 管理" },
];

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
  /** 標題列下方麵包屑（Poll／Quiz 管理等） */
  breadcrumb?: React.ReactNode;
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
}: HostShellProps): React.JSX.Element {
  return (
    <main className="le-page-bg min-h-full">
      <AppHeader
        brand={title}
        brandHref={HOST_DASHBOARD_HASH}
        brandAddon={titleAddon}
        tagline={subtitle ?? ""}
        meta={<HostSessionMeta roomId={roomId} />}
        maxWidth="7xl"
        onLogout={onLogout}
        actions={actions}
        chromeFooterActions={
          <HostRoomHeaderActions
            roomId={roomId}
            {...(presentHref ? { presentHref } : {})}
          />
        }
        navItems={HOST_NAV.map((item) => ({
          href: `#/rooms/${roomId}/${item.segment}`,
          label: item.label,
          active: activeNav === item.id,
        }))}
      />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        {breadcrumb ? (
          <div className="border-b border-border/60 pb-3 pt-4">{breadcrumb}</div>
        ) : null}
        <div className="py-6">{children}</div>
      </div>
    </main>
  );
}
