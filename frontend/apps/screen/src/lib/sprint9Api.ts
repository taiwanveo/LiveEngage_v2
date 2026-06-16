/** Sprint 9 讀取 API（Screen 唯讀）。 */

import { api } from "./api";

export interface QuizQuestion {
  id: string;
  quiz_interaction_id: string;
  child_interaction_id: string;
  title: string | null;
  time_limit_s: number;
  base_points: number;
  speed_bonus: boolean;
  explanation: string | null;
  state: string;
  result_visible?: boolean;
  options: { id: string; text: string; order_no: number; is_correct?: boolean | null }[];
}

export interface LeaderboardEntry {
  participant_id: string;
  display_name: string | null;
  total_score: string;
  rank: number;
}

export async function listQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  return api<QuizQuestion[]>(`/api/v1/quizzes/${quizId}/questions`);
}

export async function getQuizLeaderboard(
  quizId: string
): Promise<{ entries: LeaderboardEntry[] }> {
  return api(`/api/v1/quizzes/${quizId}/leaderboard`);
}

export interface IdeaPublic {
  id: string;
  content: string;
  author_display: string | null;
  is_hidden?: boolean;
  reaction_total: number;
  reactions: { emoji: string; count: number; reacted_by_me: boolean }[];
}

export async function listIdeas(
  boardId: string,
  sort: "top" | "newest" = "top"
): Promise<{ items: IdeaPublic[] }> {
  return api(`/api/v1/ideas-boards/${boardId}/ideas?sort=${sort}`);
}

export async function getSurveyResults(surveyId: string): Promise<{
  submission_count: number;
  questions: {
    child_interaction_id: string;
    title?: string | null;
    question_type?: string | null;
    response_count: number;
    option_counts?: Record<string, number> | null;
    rating_counts?: Record<string, number> | null;
  }[];
}> {
  return api(`/api/v1/surveys/${surveyId}/results`);
}
