/**
 * @deprecated 請改用 HostRoomNavHeader。保留以相容舊引用。
 */

import * as React from "react";
import { HostRoomNavHeader } from "./HostRoomNavHeader";
import type { HostRoomNavItem, HostRoomSessionMeta } from "./HostRoomNavHeader";

export interface SessionToolbarProps {
  title: string;
  dateLabel: string;
  code: string;
  visibilityLabel: string;
  statusLabel?: string;
  statusBadgeVariant?: "live" | "accent" | "muted";
  navItems?: HostRoomNavItem[];
  backLabel?: string;
  navControls?: React.ReactNode;
  onBack?: () => void;
  titleHref?: string;
  /** @deprecated 請改用 brandHref */
  brandHref?: string;
  onLogout?: () => void;
  extra?: React.ReactNode;
  chromeFooterActions?: React.ReactNode;
}

export function SessionToolbar({
  title,
  dateLabel,
  code,
  visibilityLabel,
  statusLabel,
  statusBadgeVariant,
  navItems = [],
  navControls,
  titleHref,
  brandHref,
  onLogout,
  extra,
  chromeFooterActions,
}: SessionToolbarProps): React.JSX.Element {
  const sessionMeta: HostRoomSessionMeta = {
    dateLabel,
    code,
    visibilityLabel,
    ...(statusLabel ? { statusLabel, statusBadgeVariant } : {}),
  };

  return (
    <HostRoomNavHeader
      title={title}
      {...(brandHref ?? titleHref
        ? { brandHref: brandHref ?? titleHref! }
        : {})}
      sessionMeta={sessionMeta}
      navItems={navItems}
      {...(navControls ? { navControls } : {})}
      {...(onLogout ? { onLogout } : {})}
      {...(extra ? { titleExtra: extra } : {})}
      {...(chromeFooterActions ? { chromeFooterActions } : {})}
    />
  );
}
