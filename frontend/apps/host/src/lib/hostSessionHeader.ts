/** Host 房間頂欄 session 資訊列（工作台／即時總覽共用）。 */

import type { HostRoomSessionMeta } from "@liveengage/ui";
import type { SessionHost, SessionVisibility } from "./sessionApi";

export const SESSION_VISIBILITY_LABEL: Record<SessionVisibility, string> = {
  public: "公開",
  hidden: "隱藏",
  passcode: "密碼加入",
  sso: "SSO 登入",
  restricted: "限制加入",
};

export const SESSION_STATUS_LABEL: Record<SessionHost["status"], string> = {
  draft: "草稿",
  live: "進行中",
  ended: "已結束",
  archived: "已封存",
};

export function sessionStatusBadge(session: SessionHost): {
  label: string;
  variant: "live" | "accent" | "muted";
} {
  switch (session.status) {
    case "live":
      return { label: SESSION_STATUS_LABEL.live, variant: "live" };
    case "draft":
      return { label: SESSION_STATUS_LABEL.draft, variant: "muted" };
    case "ended":
      return { label: SESSION_STATUS_LABEL.ended, variant: "muted" };
    case "archived":
      return { label: SESSION_STATUS_LABEL.archived, variant: "muted" };
  }
}

export function hostSessionMetaFromSession(session: SessionHost): HostRoomSessionMeta {
  const badge = sessionStatusBadge(session);
  return {
    dateLabel: new Date(session.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    code: session.code,
    visibilityLabel: SESSION_VISIBILITY_LABEL[session.visibility],
    activityLabel: session.title,
    statusLabel: badge.label,
    statusBadgeVariant: badge.variant,
  };
}
