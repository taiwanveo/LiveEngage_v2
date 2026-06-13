/** Present 端 Session API（Host 登入後選擇投影）。 */

import { api } from "./api";

export type SessionStatus = "draft" | "live" | "ended" | "archived";

export interface SessionHost {
  id: string;
  title: string;
  code: string;
  status: SessionStatus;
  default_room_id: string | null;
}

export interface SessionHostList {
  items: SessionHost[];
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
}

const POLL_TYPES = new Set([
  "multiple_choice",
  "word_cloud",
  "open_text",
  "rating",
  "ranking",
]);

export function isPollType(type: string): boolean {
  return POLL_TYPES.has(type);
}

export async function listSessions(): Promise<SessionHost[]> {
  const res = await api<SessionHostList>("/api/v1/sessions");
  return res.items;
}

export async function getSessionState(sessionId: string): Promise<SessionState> {
  return api<SessionState>(`/api/v1/sessions/${sessionId}/state`);
}

export interface InteractionSummary {
  id: string;
  room_id: string;
  type: string;
  title: string | null;
  status: string;
}

export async function listInteractions(
  roomId: string
): Promise<InteractionSummary[]> {
  return api<InteractionSummary[]>(`/api/v1/rooms/${roomId}/interactions`);
}

export function presentPollUrl(roomId: string, pollId: string): string {
  return `#/rooms/${roomId}/polls/${pollId}/present`;
}
