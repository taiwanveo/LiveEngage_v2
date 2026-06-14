import * as React from "react";
import { AppHeader } from "@liveengage/ui";

export type HostNavId = "moderation" | "polls" | "sprint9";

const HOST_NAV: { id: HostNavId; segment: string; label: string }[] = [
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
}: HostShellProps): React.JSX.Element {
  return (
    <main className="le-page-bg min-h-full">
      <AppHeader
        brand={title}
        brandAddon={titleAddon}
        tagline={subtitle ?? ""}
        meta={`room: ${roomId}`}
        maxWidth="7xl"
        onLogout={onLogout}
        actions={actions}
        navItems={HOST_NAV.map((item) => ({
          href: `#/rooms/${roomId}/${item.segment}`,
          label: item.label,
          active: activeNav === item.id,
        }))}
      />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
    </main>
  );
}
