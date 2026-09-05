/** Session Overview API（Host 即時總覽）。 */

import { api } from "./api";
import { apiUrl } from "@liveengage/realtime";
import type { PollResults } from "@liveengage/renderers";
import type { SessionStatus } from "./sessionApi";

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

export interface PollOptionPublic {
  id: string;
  text: string;
  order_no: number;
}

export interface ActivePollOverview {
  interaction_id: string;
  room_id: string;
  title: string | null;
  type: string;
  options: PollOptionPublic[];
  results: PollResults;
}

export interface LeaderboardEntry {
  participant_id: string;
  display_name: string | null;
  total_score: string;
  total_elapsed_ms: number;
  rank: number;
}

export interface QuizLeaderboardTop {
  quiz_interaction_id: string;
  title: string | null;
  entries: LeaderboardEntry[];
}

export interface SurveyOverviewSummary {
  survey_interaction_id: string;
  title: string | null;
  submission_count: number;
}

export interface SessionOverviewResponse {
  session_id: string;
  title: string;
  status: SessionStatus;
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

/** Overview 輪詢間隔（participant_count 等無 WS 事件欄位）。 */
export const OVERVIEW_POLL_INTERVAL_MS = 12_000;

// ── AI 決策報告（會後一鍵高階洞察報告）───────────────────────

export interface DecisionConsensus {
  title: string;
  evidence: string;
  impact: string;
}

export interface DecisionDivergence {
  topic: string;
  description: string;
  suggested_compromise: string;
}

export interface UnansweredTopQuestion {
  question: string;
  upvotes: number;
  why_important: string;
  suggested_response_direction: string;
}

export interface ActionRecommendation {
  owner: string;
  action: string;
  priority: "high" | "medium" | "low" | string;
  timeline: string;
}

export interface AiDecisionReport {
  session_id: string;
  session_title: string;
  generated_at: string;
  executive_summary: string;
  engagement_rating: string;
  key_metrics: {
    participant_count?: number;
    participants_engaged?: number;
    engaged_percent?: number;
    poll_votes_total?: number;
    qa_questions_total?: number;
    answered_count?: number;
    [key: string]: any;
  };
  key_consensuses: DecisionConsensus[];
  divergences: DecisionDivergence[];
  unanswered_concerns: UnansweredTopQuestion[];
  action_recommendations: ActionRecommendation[];
  markdown_content: string;
}

export async function getAiDecisionReport(
  sessionId: string
): Promise<AiDecisionReport | null> {
  try {
    return await api<AiDecisionReport>(`/api/v1/sessions/${sessionId}/ai-report`);
  } catch (err: any) {
    if (err?.code === "NOT_FOUND" || err?.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function generateAiDecisionReport(
  sessionId: string,
  forceRefresh = false
): Promise<AiDecisionReport> {
  return api<AiDecisionReport>(`/api/v1/sessions/${sessionId}/ai-report`, {
    method: "POST",
    body: { force_refresh: forceRefresh },
  });
}

export function getAiDecisionReportDownloadUrl(sessionId: string): string {
  return apiUrl(`/api/v1/sessions/${sessionId}/ai-report/download`);
}

