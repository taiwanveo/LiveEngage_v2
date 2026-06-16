/** Screen 投影遙控 API（Host）。 */

import { api, newIdempotencyKey } from "./api";

export type ScreenViewKind =
  | "standby"
  | "test"
  | "overview"
  | "poll"
  | "qa"
  | "quiz"
  | "ideas"
  | "survey";

export type ScreenSubView =
  | "question"
  | "results"
  | "leaderboard"
  | "hot_questions";

export interface ScreenDisplayState {
  view: ScreenViewKind;
  interaction_id: string | null;
  sub_view: ScreenSubView | null;
  session_id: string | null;
  session_title: string | null;
  updated_at: string;
}

export interface ScreenStateUpdate {
  view: ScreenViewKind;
  interaction_id?: string | null | undefined;
  sub_view?: ScreenSubView | null | undefined;
  session_title?: string | null | undefined;
}

export interface ScreenTokenResponse {
  token: string;
  room_id: string;
  expires_at: string;
}

export async function mintScreenToken(roomId: string): Promise<ScreenTokenResponse> {
  return api<ScreenTokenResponse>(`/api/v1/rooms/${roomId}/screen-token`, {
    method: "POST",
  });
}

export async function revokeScreenToken(roomId: string): Promise<void> {
  await api(`/api/v1/rooms/${roomId}/screen-token/revoke`, { method: "POST" });
}

export async function updateScreenState(
  roomId: string,
  payload: ScreenStateUpdate
): Promise<ScreenDisplayState> {
  return api<ScreenDisplayState>(`/api/v1/rooms/${roomId}/screen`, {
    method: "PUT",
    body: payload,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function getScreenState(roomId: string): Promise<ScreenDisplayState> {
  return api<ScreenDisplayState>(`/api/v1/rooms/${roomId}/screen`);
}
