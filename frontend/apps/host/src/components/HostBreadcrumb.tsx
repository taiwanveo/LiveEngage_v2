/** Host 麵包屑導覽：顯示層級上下文並支援點擊跳轉。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { HOST_DASHBOARD_HASH } from "./HostShell";
import { listSessions } from "../lib/sessionApi";

export interface HostBreadcrumbItem {
  label: string;
  href?: string;
}

interface HostBreadcrumbProps {
  items: HostBreadcrumbItem[];
}

export function HostBreadcrumb({ items }: HostBreadcrumbProps): React.JSX.Element {
  return (
    <nav
      aria-label="麵包屑導覽"
      className="flex flex-wrap items-center gap-1.5 text-xs leading-snug"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 ? (
              <span className="select-none text-muted/50" aria-hidden>
                /
              </span>
            ) : null}
            {item.href && !isLast ? (
              <a
                href={item.href}
                className="max-w-[12rem] truncate text-muted transition-colors hover:text-accent hover:underline sm:max-w-none"
              >
                {item.label}
              </a>
            ) : (
              <span
                className={`max-w-[14rem] truncate sm:max-w-none ${
                  isLast ? "font-medium text-foreground" : "text-muted"
                }`}
                {...(isLast ? { "aria-current": "page" as const } : {})}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/** Poll／Quiz 管理頁共用：儀表板 → 活動（工作台）→ 目前頁。 */
export function HostRoomHubBreadcrumb({
  roomId,
  currentLabel,
}: {
  roomId: string;
  currentLabel: string;
}): React.JSX.Element {
  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });

  const session = sessionsQuery.data?.find((s) => s.default_room_id === roomId);
  const sessionTitle =
    session?.title ?? (sessionsQuery.isLoading ? "載入中…" : "活動");

  const items: HostBreadcrumbItem[] = [
    { label: "活動儀表板", href: HOST_DASHBOARD_HASH },
    { label: sessionTitle, href: `#/rooms/${roomId}/workbench` },
    { label: currentLabel },
  ];

  return <HostBreadcrumb items={items} />;
}
