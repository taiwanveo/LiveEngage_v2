/** Session / Join API（FE-001/002）。 */

import { api } from "./api";

export type SessionStatus = "draft" | "live" | "ended" | "archived";
export type SessionVisibility = "public" | "passcode" | "sso" | "restricted";

export interface SessionPublic {
  id: string;
  title: string;
  code: string;
  status: SessionStatus;
  visibility: SessionVisibility;
  require_name: boolean;
  require_email: boolean;
  language: string | null;
}

export interface JoinRequest {
  passcode?: string;
  name?: string;
  email?: string;
  is_anonymous?: boolean;
  room_id?: string;
}

export interface JoinResponse {
  participant_token: string;
  token_type: string;
  session_id: string;
  room_id: string | null;
  participant_id: string;
  display_name: string | null;
  email: string | null;
  is_anonymous: boolean;
}

export interface ActiveInteraction {
  id: string;
  room_id: string;
  type: string;
  title: string | null;
  status: string;
}

export interface SessionState {
  session_id: string;
  title: string;
  code: string;
  status: SessionStatus;
  active_interactions: ActiveInteraction[];
  participant_count: number;
  server_time: string;
}

export async function resolveSessionByCode(code: string): Promise<SessionPublic> {
  return api<SessionPublic>(`/api/v1/sessions/by-code/${encodeURIComponent(code)}`, {
    public: true,
  });
}

export async function joinSession(
  sessionId: string,
  payload: JoinRequest
): Promise<JoinResponse> {
  return api<JoinResponse>(`/api/v1/sessions/${sessionId}/join`, {
    method: "POST",
    body: payload,
    public: true,
  });
}

export async function getSessionState(sessionId: string): Promise<SessionState> {
  return api<SessionState>(`/api/v1/sessions/${sessionId}/state`, {
    public: true,
  });
}
