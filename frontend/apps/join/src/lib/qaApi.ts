/** Participant Q&A API（FE-004/005）。 */

import { api, newIdempotencyKey } from "./api";

export interface QuestionReply {
  id: string;
  question_id: string;
  author_type: string;
  content: string;
  is_private: boolean;
  created_at: string;
}

export interface QuestionPublic {
  id: string;
  room_id: string;
  content: string;
  author_display: string | null;
  is_anonymous: boolean;
  status: string;
  upvote_count: number;
  downvote_count: number;
  score: number;
  highlighted: boolean;
  answered_at: string | null;
  created_at: string;
  my_vote: "up" | "down" | null;
  replies?: QuestionReply[];
}

export interface VoteResult {
  question_id: string;
  upvote_count: number;
  downvote_count: number;
  score: number;
  my_vote: "up" | "down" | null;
}

export interface QuestionListResponse {
  items: QuestionPublic[];
  next_cursor: string | null;
  downvote_enabled?: boolean;
}

export async function submitQuestion(
  roomId: string,
  payload: { content: string; is_anonymous: boolean }
): Promise<QuestionPublic> {
  return api<QuestionPublic>(`/api/v1/rooms/${roomId}/questions`, {
    method: "POST",
    body: payload,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function listQuestions(
  roomId: string,
  sort: "top" | "newest" = "top"
): Promise<QuestionListResponse> {
  return api<QuestionListResponse>(
    `/api/v1/rooms/${roomId}/questions?sort=${sort}`
  );
}

export async function voteQuestion(
  questionId: string,
  direction: "up" | "down"
): Promise<VoteResult> {
  return api<VoteResult>(`/api/v1/questions/${questionId}/vote`, {
    method: "POST",
    body: { direction },
    idempotencyKey: newIdempotencyKey(),
  });
}
