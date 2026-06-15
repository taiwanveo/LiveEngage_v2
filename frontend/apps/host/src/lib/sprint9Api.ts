/** Sprint 9 API：Quiz、Ideas、Survey（BE-006/007、FE-011/012/013）。 */

import { api, newIdempotencyKey } from "./api";

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

export async function addQuizQuestion(
  quizId: string,
  payload: {
    title: string;
    time_limit_s?: number;
    base_points?: number;
    options: { text: string; is_correct?: boolean; order_no?: number }[];
  }
): Promise<QuizQuestion> {
  return api<QuizQuestion>(`/api/v1/quizzes/${quizId}/questions`, {
    method: "POST",
    body: payload,
  });
}

export async function updateQuizQuestion(
  questionId: string,
  payload: {
    title?: string;
    description?: string;
    time_limit_s?: number;
    base_points?: number;
    speed_bonus?: boolean;
    explanation?: string;
    options?: { text: string; is_correct?: boolean; order_no?: number }[];
  }
): Promise<QuizQuestion> {
  return api<QuizQuestion>(`/api/v1/quizzes/questions/${questionId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteQuizQuestion(questionId: string): Promise<void> {
  await api<void>(`/api/v1/quizzes/questions/${questionId}`, {
    method: "DELETE",
  });
}

export async function quizAction(
  questionId: string,
  action: "start_question" | "reveal" | "next" | "close"
): Promise<{ question_id: string; state: string }> {
  return api(`/api/v1/quizzes/questions/${questionId}/actions`, {
    method: "POST",
    body: { action },
    idempotencyKey: newIdempotencyKey(),
  });
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
  sort: "newest" | "top" = "newest"
): Promise<{ items: IdeaPublic[] }> {
  return api(`/api/v1/ideas-boards/${boardId}/ideas?sort=${sort}`);
}

export async function hideIdea(ideaId: string): Promise<IdeaPublic> {
  return api(`/api/v1/ideas/${ideaId}/hide`, { method: "POST" });
}

export interface SurveyQuestion {
  id: string;
  child_interaction_id: string;
  title: string | null;
  question_type: string;
  required: boolean;
}

export async function addSurveyQuestion(
  surveyId: string,
  payload: { title: string; question_type: string; required?: boolean }
): Promise<SurveyQuestion> {
  return api<SurveyQuestion>(`/api/v1/surveys/${surveyId}/questions`, {
    method: "POST",
    body: payload,
  });
}

export async function listSurveyQuestions(surveyId: string): Promise<SurveyQuestion[]> {
  return api<SurveyQuestion[]>(`/api/v1/surveys/${surveyId}/questions`);
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

export async function submitSurvey(
  surveyId: string,
  answers: Record<string, unknown>
): Promise<{ completed: boolean }> {
  return api(`/api/v1/surveys/${surveyId}/submit`, {
    method: "POST",
    body: { answers, completed: true },
    idempotencyKey: newIdempotencyKey(),
  });
}
