/** Q&A 審核相關 API 呼叫。 */

import { api, newIdempotencyKey } from "./api";
import type { ModerateAction, QuestionPublic, QuestionStatus } from "../types";

export async function listModeration(
  roomId: string,
  status?: QuestionStatus
): Promise<QuestionPublic[]> {
  const qs = status ? `?status=${status}` : "";
  return api<QuestionPublic[]>(
    `/api/v1/rooms/${roomId}/questions/moderation${qs}`
  );
}

export async function listPublicQuestions(
  roomId: string,
  sort: "top" | "newest" = "top"
): Promise<QuestionPublic[]> {
  const res = await api<{ items: QuestionPublic[] }>(
    `/api/v1/rooms/${roomId}/questions?sort=${sort}`
  );
  return res.items;
}

export async function moderate(
  questionId: string,
  action: ModerateAction
): Promise<QuestionPublic> {
  return api<QuestionPublic>(`/api/v1/questions/${questionId}/moderate`, {
    method: "POST",
    body: { action },
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function reply(
  questionId: string,
  content: string,
  isPrivate: boolean
): Promise<{ id: string }> {
  return api<{ id: string }>(`/api/v1/questions/${questionId}/replies`, {
    method: "POST",
    body: { content, is_private: isPrivate },
    idempotencyKey: newIdempotencyKey(),
  });
}

export interface AiQuestionItem {
  id: string;
  content: string;
  author_display: string | null;
  is_anonymous: boolean;
  upvote_count: number;
  status: string;
  created_at?: string | null;
}

export interface AiQuestionCluster {
  cluster_id: string;
  primary_question: AiQuestionItem;
  duplicate_questions: AiQuestionItem[];
  combined_upvotes: number;
  similarity_reason: string;
}

export interface AiDedupQuestionsResponse {
  clusters: AiQuestionCluster[];
  total_duplicates_found: number;
  is_ai_generated: boolean;
  latency_ms: number;
}

export interface MergeQuestionsResponse {
  primary_question_id: string;
  merged_question_ids: string[];
  new_upvote_count: number;
  new_score: number;
  total_upvotes_added: number;
  message: string;
}

export async function dedupRoomQuestions(
  roomId: string
): Promise<AiDedupQuestionsResponse> {
  return api<AiDedupQuestionsResponse>(
    `/api/v1/rooms/${roomId}/questions/ai-dedup`,
    {
      method: "POST",
    }
  );
}

export async function mergeDuplicateQuestions(
  roomId: string,
  payload: {
    primary_question_id: string;
    duplicate_question_ids: string[];
  }
): Promise<MergeQuestionsResponse> {
  return api<MergeQuestionsResponse>(
    `/api/v1/rooms/${roomId}/questions/merge`,
    {
      method: "POST",
      body: payload,
    }
  );
}

