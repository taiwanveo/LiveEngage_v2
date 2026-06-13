import * as React from "react";
import { AppHeader } from "@liveengage/ui";

interface HostShellProps {
  title: string;
  subtitle?: string;
  roomId: string;
  onLogout: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function HostShell({
  title,
  subtitle,
  roomId,
  onLogout,
  children,
  actions,
}: HostShellProps): React.JSX.Element {
  return (
    <main className="le-page-bg min-h-full">
      <AppHeader
        brand={title}
        tagline={subtitle ?? ""}
        meta={`room: ${roomId}`}
        maxWidth="7xl"
        onLogout={onLogout}
        actions={actions}
        navItems={[
          { href: `#/rooms/${roomId}/moderation`, label: "Q&A 審核" },
          { href: `#/rooms/${roomId}/polls`, label: "Poll 管理" },
          { href: `#/rooms/${roomId}/sprint9`, label: "Quiz / Ideas" },
        ]}
      />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
    </main>
  );
}
