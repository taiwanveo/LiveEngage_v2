/** 參與者 Sprint 9 API（Quiz / Ideas / Survey）。 */

import { api, newIdempotencyKey } from "./api";

export interface ActiveQuizQuestion {
  id: string;
  child_interaction_id: string;
  title: string | null;
  state: string;
  result_visible: boolean;
  explanation: string | null;
  options: { id: string; text: string; is_correct?: boolean | null }[];
}

export function mapActiveQuizQuestion(raw: {
  id: string;
  child_interaction_id: string;
  title: string | null;
  state: string;
  result_visible?: boolean;
  explanation?: string | null;
  options: { id: string; text: string; is_correct?: boolean | null }[];
}): ActiveQuizQuestion {
  return {
    id: raw.id,
    child_interaction_id: raw.child_interaction_id,
    title: raw.title,
    state: raw.state,
    result_visible: Boolean(raw.result_visible),
    explanation: raw.explanation ?? null,
    options: raw.options.map((o) => ({
      id: o.id,
      text: o.text,
      is_correct: o.is_correct ?? null,
    })),
  };
}

export async function getActiveQuizQuestion(
  quizId: string
): Promise<ActiveQuizQuestion | null> {
  const data = await api<ActiveQuizQuestion | null>(
    `/api/v1/quizzes/${quizId}/active-question`
  );
  return data ? mapActiveQuizQuestion(data) : null;
}

export async function submitQuizAnswer(
  questionId: string,
  optionIds: string[]
): Promise<{ is_correct: boolean; score: string }> {
  return api(`/api/v1/quizzes/questions/${questionId}/answers`, {
    method: "POST",
    body: { option_ids: optionIds },
    idempotencyKey: newIdempotencyKey(),
  });
}

export interface IdeaItem {
  id: string;
  content: string;
  author_display: string | null;
  reaction_total: number;
}

export async function listBoardIdeas(boardId: string): Promise<{ items: IdeaItem[] }> {
  return api(`/api/v1/ideas-boards/${boardId}/ideas`);
}

export async function submitIdea(
  boardId: string,
  content: string
): Promise<IdeaItem> {
  return api(`/api/v1/ideas-boards/${boardId}/ideas`, {
    method: "POST",
    body: { content },
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function reactIdea(ideaId: string, emoji: string): Promise<IdeaItem> {
  return api(`/api/v1/ideas/${ideaId}/react`, {
    method: "POST",
    body: { emoji },
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function submitSurveyAnswers(
  surveyId: string,
  answers: Record<string, unknown>
): Promise<{ completed: boolean }> {
  return api(`/api/v1/surveys/${surveyId}/submit`, {
    method: "POST",
    body: { answers, completed: true },
    idempotencyKey: newIdempotencyKey(),
  });
}

export interface SurveyParticipantQuestion {
  child_interaction_id: string;
  title: string | null;
  question_type: string;
  required: boolean;
  page_no: number;
  order_no: number;
  options: { id: string; text: string; order_no: number }[];
  settings: Record<string, unknown>;
}

export async function listSurveyQuestions(
  surveyId: string
): Promise<SurveyParticipantQuestion[]> {
  return api<SurveyParticipantQuestion[]>(
    `/api/v1/surveys/${surveyId}/participant-questions`
  );
}

export const S9_TYPES = new Set(["quiz", "ideas", "survey"]);

export function isS9Type(type: string): boolean {
  return S9_TYPES.has(type);
}
