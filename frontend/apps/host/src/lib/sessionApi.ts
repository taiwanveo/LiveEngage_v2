/** Session API（FE-001 Host 端）。 */

import { api } from "./api";

export type SessionStatus = "draft" | "live" | "ended" | "archived";
export type SessionVisibility = "public" | "hidden" | "passcode" | "sso" | "restricted";

export interface SessionHost {
  id: string;
  org_id: string;
  title: string;
  code: string;
  status: SessionStatus;
  visibility: SessionVisibility;
  default_room_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionHostList {
  items: SessionHost[];
}

export async function listSessions(): Promise<SessionHost[]> {
  const res = await api<SessionHostList>("/api/v1/sessions");
  return res.items;
}

export async function createSession(payload: {
  title: string;
  visibility?: SessionVisibility;
  passcode?: string;
}): Promise<SessionHost> {
  return api<SessionHost>("/api/v1/sessions", {
    method: "POST",
    body: {
      title: payload.title,
      visibility: payload.visibility ?? "public",
      ...(payload.passcode ? { passcode: payload.passcode } : {}),
    },
  });
}

export async function updateSession(
  sessionId: string,
  payload: { status?: SessionStatus; title?: string }
): Promise<SessionHost> {
  return api<SessionHost>(`/api/v1/sessions/${sessionId}`, {
    method: "PATCH",
    body: payload,
  });
}

/** 參與者加入連結（生產預設 le-participant.zeabur.app）。 */
export { participantJoinUrl } from "@liveengage/ui";
