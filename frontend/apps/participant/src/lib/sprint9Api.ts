/** 參與者 Sprint 9 API（Quiz / Ideas / Survey）。 */

import { api, newIdempotencyKey } from "./api";

export interface ActiveQuizQuestion {
  id: string;
  title: string | null;
  state: string;
  options: { id: string; text: string }[];
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

export const S9_TYPES = new Set(["quiz", "ideas", "survey"]);

export function isS9Type(type: string): boolean {
  return S9_TYPES.has(type);
}
