/** Session Overview API（Screen）。 */

import { api } from "./api";
import type { PollResults } from "@liveengage/renderers";

export interface ParticipantHostItem {
  id: string | null;
  display_name: string | null;
  is_anonymous: boolean;
  joined_at: string | null;
}

export interface ParticipantListResponse {
  items: ParticipantHostItem[];
  total_count: number;
  next_cursor: string | null;
}

export interface EngagementSummary {
  participant_count: number;
  participants_engaged: number;
  engaged_percent: number;
  qa_questions_total: number;
  poll_votes_total: number;
  participants_qa: number;
  participants_poll_voters: number;
}

export interface OverviewQuestionSummary {
  id: string;
  room_id: string;
  content: string;
  author_display: string | null;
  is_anonymous: boolean;
  score: number;
  upvote_count: number;
}

export interface ActivePollOverview {
  interaction_id: string;
  room_id: string;
  title: string | null;
  type: string;
  options: { id: string; text: string; order_no: number }[];
  results: PollResults;
}

export interface QuizLeaderboardTop {
  quiz_interaction_id: string;
  title: string | null;
  entries: { participant_id: string; display_name: string | null; total_score: string; rank: number }[];
}

export interface SurveyOverviewSummary {
  survey_interaction_id: string;
  title: string | null;
  submission_count: number;
}

export interface SessionOverviewResponse {
  session_id: string;
  title: string;
  status: string;
  focus_room_id: string | null;
  participant_count: number;
  engagement: EngagementSummary;
  active_poll: ActivePollOverview | null;
  top_questions: OverviewQuestionSummary[];
  quiz_leaderboard_top: QuizLeaderboardTop | null;
  survey_summary: SurveyOverviewSummary | null;
}

export async function getSessionOverview(
  sessionId: string,
  roomId?: string
): Promise<SessionOverviewResponse> {
  const query = roomId ? `?room_id=${encodeURIComponent(roomId)}` : "";
  return api<SessionOverviewResponse>(
    `/api/v1/sessions/${sessionId}/overview${query}`
  );
}

export async function listSessionParticipants(
  sessionId: string,
  cursor?: string
): Promise<ParticipantListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return api<ParticipantListResponse>(
    `/api/v1/sessions/${sessionId}/participants${qs ? `?${qs}` : ""}`
  );
}

export const OVERVIEW_POLL_INTERVAL_MS = 12_000;
