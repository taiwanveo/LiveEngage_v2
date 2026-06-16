/** Screen display state API。 */

import { api } from "./api";

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
  | "hot_questions"
  | null;

export interface ScreenDisplayState {
  view: ScreenViewKind;
  interaction_id: string | null;
  sub_view: ScreenSubView;
  session_id: string | null;
  session_title: string | null;
  updated_at: string;
}

export async function getScreenState(roomId: string): Promise<ScreenDisplayState> {
  return api<ScreenDisplayState>(`/api/v1/rooms/${roomId}/screen`);
}

export async function resolveSessionByCode(code: string): Promise<{
  id: string;
  title: string;
  code: string;
}> {
  return api(`/api/v1/sessions/by-code/${encodeURIComponent(code)}`, { public: true });
}
