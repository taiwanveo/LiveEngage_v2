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
